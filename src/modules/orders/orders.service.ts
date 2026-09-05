import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth/auth.config';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Branch,
  Business,
  BusinessInvoice,
  Customer,
  NewOrderItem,
  Order,
  OrderItem,
} from '../../database/schema';
import { InvoicesService } from '../invoices/invoices.service';
import { computeVatCents } from '../invoices/vat';
import {
  apportion,
  assertWithinBase,
  assertWithinCap,
  resolveDiscountCents,
} from './discounts';
import type { CheckoutItemDto, CreateOrderDto } from './dto/order-request.dto';
import { type ListOrdersFilters, OrdersRepository } from './orders.repository';
import { and, eq } from 'drizzle-orm';
import { CashService } from '../cash/cash.service';
import { CustomersService } from '../customers/customers.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { unitCostFor } from './unit-cost';
import { ReferralsService } from '../referrals/referrals.service';
import { OrderTokensService } from './order-tokens.service';
import { SectorPluginRegistry } from './sector-plugins/registry';
import type {
  CheckoutContext,
  CheckoutLine,
} from './sector-plugins/sector-plugin.interface';

const BUYER_PAN_REQUIRED_ABOVE_CENTS = 1_000_000;

const QUANTITY_SCALE = 3;

function lineKey(item: {
  productId?: string;
  menuItemId?: string;
  serviceItemId?: string;
}): string {
  return item.productId ?? item.menuItemId ?? item.serviceItemId ?? '';
}

interface CheckoutTotals {
  subtotalCents: number;
  discountCents: number;
  serviceChargeCents: number;
  taxCents: number;
  totalCents: number;
}

export interface CheckoutResult {
  order: Order;
  items: OrderItem[];
  invoice: BusinessInvoice | null;
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  invoice: BusinessInvoice | null;
}

export interface CheckoutRequest {
  business: Business;
  branch: Branch;
  dto: CreateOrderDto;
  actorUserId: string | null;
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly ordersRepository: OrdersRepository,
    private readonly invoicesService: InvoicesService,
    private readonly sectorPlugins: SectorPluginRegistry,
    private readonly customers: CustomersService,
    private readonly cash: CashService,
    private readonly loyalty: LoyaltyService,
    private readonly referrals: ReferralsService,
    private readonly orderTokens: OrderTokensService,
  ) {}

  async getById(businessId: string, id: string): Promise<OrderDetail> {
    const order = await this.ordersRepository.findById(businessId, id);

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const [items, invoice] = await Promise.all([
      this.ordersRepository.findItems(businessId, id),
      this.ordersRepository.findInvoiceForOrder(businessId, id),
    ]);

    return { order, items, invoice: invoice ?? null };
  }

  async list(filters: ListOrdersFilters): Promise<PaginatedResult<Order>> {
    const [data, total] = await Promise.all([
      this.ordersRepository.findMany(filters),
      this.ordersRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async checkout(request: CheckoutRequest): Promise<CheckoutResult> {
    const { business, branch, dto, actorUserId, headers } = request;

    const plugin = this.sectorPlugins.resolve(business);
    plugin.beforeCreate(business);

    if (dto.customerId && dto.customer) {
      throw new BadRequestException(
        'Provide either customerId or customer, not both',
      );
    }

    if (dto.clientRequestId) {
      const replayed = await this.ordersRepository.findByClientRequestId(
        business.id,
        dto.clientRequestId,
      );

      if (replayed) {
        const detail = await this.getById(business.id, replayed.id);
        return {
          order: detail.order,
          items: detail.items,
          invoice: detail.invoice,
        };
      }
    }

    const existingCustomer = dto.customerId
      ? await this.requireCustomer(business.id, dto.customerId)
      : null;

    this.assertNoDuplicateProducts(dto);

    return this.db.transaction(async (tx) => {
      const billsNow = plugin.billsOnCreate(dto);

      const context: CheckoutContext = {
        executor: tx,
        business,
        branch,
        dto,
        actorUserId,
        headers,
      };

      const customer =
        existingCustomer ??
        (await this.resolveInlineCustomer(tx, business, dto));

      const lines: CheckoutLine[] = [];

      const items = [...dto.items].sort((a, b) =>
        lineKey(a).localeCompare(lineKey(b)),
      );

      for (const item of items) {
        const produced = await plugin.onLineItemAdd(context, item);
        this.applyLineDiscount(item, produced);
        lines.push(...produced);
      }

      await plugin.beforeCheckout(context, lines, customer);

      const totals = this.computeTotals(business, dto, lines, customer);

      const channelCommissionCents = await this.resolveChannelCommission(
        tx,
        business.id,
        dto.channelId,
        totals.totalCents,
      );

      if (totals.discountCents > 0) {
        await this.assertMayDiscount(business, headers);
      }

      const tokenNumber = dto.tableId
        ? null
        : await this.orderTokens.next(
            tx,
            business.id,
            branch.id,
            await this.timezoneFor(tx, business.id),
          );

      const order = await this.ordersRepository.insertOrder(tx, {
        id: randomUUID(),
        businessId: business.id,
        branchId: branch.id,
        customerId: customer?.id ?? null,
        tableId: dto.tableId ?? null,
        tokenNumber,
        promisedAt: dto.promisedAt ? new Date(dto.promisedAt) : null,
        source: dto.source ?? 'staff',
        channelId: dto.channelId ?? null,
        channelCommissionCents,
        status: billsNow ? 'billed' : 'placed',
        serviceChargeCents: totals.serviceChargeCents,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        createdByUserId: actorUserId,
        clientRequestId: dto.clientRequestId ?? null,
        sectorData: dto.sectorData ?? {},
      });

      const orderItems = await this.ordersRepository.insertOrderItems(
        tx,
        lines.map<NewOrderItem>((line) => ({
          id: randomUUID(),
          orderId: order.id,
          businessId: business.id,
          productId: line.product?.id ?? null,
          menuItemId: line.menuItem?.id ?? null,
          serviceItemId: line.serviceItem?.id ?? null,
          productName:
            line.product?.name ??
            line.menuItem?.name ??
            line.serviceItem?.name ??
            'Unknown',
          modifiers: line.modifiers ?? [],
          note: line.note ?? null,
          batchId: line.batchId,
          quantity: line.quantity.toFixed(QUANTITY_SCALE),
          unitPriceCents: line.unitPriceCents,
          unitCostCents: line.unitCostCents ?? unitCostFor(line),
          discountCents: line.discountCents ?? 0,
          lineTotalCents: line.lineTotalCents,
        })),
      );

      const invoice = billsNow
        ? await this.invoicesService.issue(
            tx,
            this.invoiceLineBuilder(
              business,
              branch,
              order,
              customer,
              actorUserId,
            ),
          )
        : null;

      if (dto.onCredit) {
        if (!customer) {
          throw new BadRequestException(
            'i18n:errors.customer.creditNeedsCustomer',
          );
        }

        if (!invoice) {
          throw new BadRequestException(
            'i18n:errors.customer.creditNeedsInvoice',
          );
        }

        await this.customers.chargeSale(
          tx,
          business.id,
          customer.id,
          invoice.totalCents,
          invoice.id,
          actorUserId,
        );
      }

      if (invoice && customer) {
        await this.loyalty.awardForInvoice(tx, business, customer.id, invoice);
        await this.referrals.awardForInvoice(tx, business, customer, invoice);
      }

      if (invoice && dto.payments?.length) {
        await this.cash.recordPayments(tx, {
          businessId: business.id,
          branchId: branch.id,
          invoice,
          payments: dto.payments,
          actorUserId,
        });
      }

      await plugin.afterCheckout(context, {
        order,
        items: orderItems,
        invoice,
        lines,
        customer,
      });

      return { order, items: orderItems, invoice };
    });
  }

  private async resolveChannelCommission(
    executor: DatabaseExecutor,
    businessId: string,
    channelId: string | undefined,
    totalCents: number,
  ): Promise<number> {
    if (!channelId) {
      return 0;
    }

    const [channel] = await executor
      .select()
      .from(schema.salesChannels)
      .where(
        and(
          eq(schema.salesChannels.businessId, businessId),
          eq(schema.salesChannels.id, channelId),
          eq(schema.salesChannels.isActive, true),
        ),
      )
      .limit(1);

    if (!channel) {
      throw new NotFoundException({
        message: 'i18n:errors.channel.notFound',
        channelId,
      });
    }

    return Math.round((totalCents * Number(channel.commissionPercent)) / 100);
  }

  private async assertMayDiscount(
    business: Business,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const result = await auth.api.hasPermission({
      headers: fromNodeHeaders(headers),
      body: {
        organizationId: business.organizationId,
        permissions: { order: ['discount'] },
      },
    });

    if (!result?.success) {
      throw new ForbiddenException('i18n:errors.discount.notPermitted');
    }
  }

  private applyLineDiscount(
    item: CheckoutItemDto,
    produced: CheckoutLine[],
  ): void {
    const grossCents = produced.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    );
    const discountCents = resolveDiscountCents(grossCents, item);

    if (discountCents === 0) {
      return;
    }

    assertWithinBase(discountCents, grossCents);

    const shares = apportion(
      discountCents,
      produced.map((line) => line.lineTotalCents),
    );

    produced.forEach((line, index) => {
      line.discountCents = shares[index];
    });
  }

  private computeTotals(
    business: Business,
    dto: CreateOrderDto,
    lines: CheckoutLine[],
    customer: Customer | null,
  ): CheckoutTotals {
    const subtotalCents = lines.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    );

    const lineDiscountCents = lines.reduce(
      (total, line) => total + (line.discountCents ?? 0),
      0,
    );

    const netOfLinesCents = subtotalCents - lineDiscountCents;
    const orderDiscountCents = resolveDiscountCents(netOfLinesCents, dto);
    assertWithinBase(orderDiscountCents, netOfLinesCents);

    const orderShares = apportion(
      orderDiscountCents,
      lines.map((line) => line.lineTotalCents - (line.discountCents ?? 0)),
    );

    lines.forEach((line, index) => {
      line.discountCents = (line.discountCents ?? 0) + orderShares[index];
    });

    const discountCents = lineDiscountCents + orderDiscountCents;
    assertWithinCap(discountCents, subtotalCents, business.maxDiscountPercent);

    const netCents = subtotalCents - discountCents;
    const serviceChargeCents = Math.round(
      (netCents * business.serviceChargePercent) / 100,
    );
    const taxCents = computeVatCents(
      netCents + serviceChargeCents,
      business.vatRegistered,
    );
    const totalCents = netCents + serviceChargeCents + taxCents;

    if (
      business.vatRegistered &&
      totalCents > BUYER_PAN_REQUIRED_ABOVE_CENTS &&
      !customer?.panNumber
    ) {
      throw new BadRequestException('i18n:errors.invoice.buyerPanRequired');
    }

    return {
      subtotalCents,
      discountCents,
      serviceChargeCents,
      taxCents,
      totalCents,
    };
  }

  private async timezoneFor(
    executor: DatabaseExecutor,
    businessId: string,
  ): Promise<string> {
    const [row] = await executor
      .select({ timezone: schema.businessSettings.timezone })
      .from(schema.businessSettings)
      .where(eq(schema.businessSettings.businessId, businessId))
      .limit(1);

    return row?.timezone ?? 'Asia/Kathmandu';
  }

  async listForTable(businessId: string, tableId: string): Promise<Order[]> {
    return this.ordersRepository.findByTable(businessId, tableId);
  }

  private invoiceLineBuilder(
    business: Business,
    branch: Branch,
    order: Order,
    customer: Customer | null,
    actorUserId: string | null,
  ) {
    return {
      business,
      branchId: branch.id,
      orderId: order.id,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      serviceChargeCents: order.serviceChargeCents,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      customerPan: customer?.panNumber ?? null,
      actorUserId,
    };
  }

  private assertNoDuplicateProducts(dto: CreateOrderDto): void {
    const seen = new Set<string>();

    for (const item of dto.items) {
      const key = [
        lineKey(item),
        item.batchId ?? '',
        JSON.stringify(item.modifiers ?? []),
      ].join('|');

      if (seen.has(key)) {
        throw new BadRequestException(
          `${lineKey(item)} appears more than once; merge the quantities instead`,
        );
      }
      seen.add(key);
    }
  }

  private async requireCustomer(
    businessId: string,
    customerId: string,
  ): Promise<Customer> {
    const found = await this.ordersRepository.findCustomerById(
      businessId,
      customerId,
    );

    if (!found) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    return found;
  }

  private async resolveInlineCustomer(
    executor: DatabaseExecutor,
    business: Business,
    dto: CreateOrderDto,
  ): Promise<Customer | null> {
    if (!dto.customer) {
      return null;
    }

    return this.ordersRepository.insertCustomer(executor, {
      id: randomUUID(),
      businessId: business.id,
      name: dto.customer.name,
      phone: dto.customer.phone ?? null,
      panNumber: dto.customer.panNumber ?? null,
    });
  }
}

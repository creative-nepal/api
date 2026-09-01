import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
} from '../../database';
import type {
  Business,
  BusinessInvoice,
  Customer,
  NewOrderItem,
  Order,
  OrderItem,
} from '../../database/schema';
import { InvoicesService } from '../invoices/invoices.service';
import { computeVatCents } from '../invoices/vat';
import type { CreateOrderDto } from './dto/order-request.dto';
import { type ListOrdersFilters, OrdersRepository } from './orders.repository';
import { SectorPluginRegistry } from './sector-plugins/registry';
import type {
  CheckoutContext,
  CheckoutLine,
} from './sector-plugins/sector-plugin.interface';

const BUYER_PAN_REQUIRED_ABOVE_CENTS = 1_000_000;

const QUANTITY_SCALE = 3;

function lineKey(item: { productId?: string; menuItemId?: string }): string {
  return item.productId ?? item.menuItemId ?? '';
}

interface CheckoutTotals {
  subtotalCents: number;
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
    const { business, dto, actorUserId, headers } = request;

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
      const context: CheckoutContext = {
        executor: tx,
        business,
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
        lines.push(...(await plugin.onLineItemAdd(context, item)));
      }

      await plugin.beforeCheckout(context, lines, customer);

      const totals = this.computeTotals(business, lines, customer);

      const order = await this.ordersRepository.insertOrder(tx, {
        id: randomUUID(),
        businessId: business.id,
        customerId: customer?.id ?? null,
        tableId: dto.tableId ?? null,
        source: dto.source ?? 'staff',
        status: plugin.billsOnCreate ? 'billed' : 'placed',
        serviceChargeCents: totals.serviceChargeCents,
        subtotalCents: totals.subtotalCents,
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
          productName: line.product?.name ?? line.menuItem?.name ?? 'Unknown',
          modifiers: line.modifiers ?? [],
          batchId: line.batchId,
          quantity: line.quantity.toFixed(QUANTITY_SCALE),
          unitPriceCents: line.unitPriceCents,
          lineTotalCents: line.lineTotalCents,
        })),
      );

      const invoice = plugin.billsOnCreate
        ? await this.invoicesService.issue(
            tx,
            this.invoiceLineBuilder(business, order, customer, actorUserId),
          )
        : null;

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

  private computeTotals(
    business: Business,
    lines: CheckoutLine[],
    customer: Customer | null,
  ): CheckoutTotals {
    const subtotalCents = lines.reduce(
      (total, line) => total + line.lineTotalCents,
      0,
    );

    const serviceChargeCents = Math.round(
      (subtotalCents * business.serviceChargePercent) / 100,
    );
    const taxCents = computeVatCents(
      subtotalCents + serviceChargeCents,
      business.vatRegistered,
    );
    const totalCents = subtotalCents + serviceChargeCents + taxCents;

    if (
      business.vatRegistered &&
      totalCents > BUYER_PAN_REQUIRED_ABOVE_CENTS &&
      !customer?.panNumber
    ) {
      throw new BadRequestException('i18n:errors.invoice.buyerPanRequired');
    }

    return { subtotalCents, serviceChargeCents, taxCents, totalCents };
  }

  async listForTable(businessId: string, tableId: string): Promise<Order[]> {
    return this.ordersRepository.findByTable(businessId, tableId);
  }

  private invoiceLineBuilder(
    business: Business,
    order: Order,
    customer: Customer | null,
    actorUserId: string | null,
  ) {
    return {
      business,
      orderId: order.id,
      subtotalCents: order.subtotalCents,
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

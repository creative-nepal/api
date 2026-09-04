import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type {
  Business,
  BusinessInvoice,
  OrderItem,
} from '../../../../database/schema';
import { InvoicesService } from '../../../../modules/invoices/invoices.service';
import { apportion } from '../../../../modules/orders/discounts';
import { computeVatCents } from '../../../../modules/invoices/vat';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { TablesService } from '../tables/tables.service';
import type { BillTableDto } from './dto/bill-table.dto';

interface BillPortion {
  lines: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  serviceChargeCents: number;
  vatCents: number;
}

@Injectable()
export class TableBillingService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly tablesService: TablesService,
    private readonly invoicesService: InvoicesService,
    private readonly tableSessionsService: TableSessionsService,
  ) {}

  async billTable(
    business: Business,
    tableId: string,
    dto: BillTableDto,
    actorUserId: string,
  ): Promise<BusinessInvoice[]> {
    const table = await this.tablesService.getById(business.id, tableId);

    const unbilled = await this.findUnbilledLines(business.id, tableId);

    if (unbilled.length === 0) {
      throw new BadRequestException(
        `Table ${table.tableNo} has nothing to bill`,
      );
    }

    const portions = this.resolvePortions(unbilled, dto, business);

    return this.db.transaction(async (tx) => {
      const invoices: BusinessInvoice[] = [];

      for (const portion of portions) {
        const invoice = await this.invoicesService.issue(tx, {
          business,
          branchId: table.branchId,
          orderId: null,
          subtotalCents: portion.subtotalCents,
          discountCents: portion.discountCents,
          serviceChargeCents: portion.serviceChargeCents,
          vatCentsOverride: portion.vatCents,
          actorUserId,
        });

        if (portion.lines.length > 0) {
          await tx
            .update(schema.orderItems)
            .set({ invoiceId: invoice.id })
            .where(
              and(
                eq(schema.orderItems.businessId, business.id),
                inArray(
                  schema.orderItems.id,
                  portion.lines.map((line) => line.id),
                ),
              ),
            );
        }

        invoices.push(invoice);
      }

      await tx
        .update(schema.orders)
        .set({ status: 'billed' })
        .where(
          and(
            eq(schema.orders.businessId, business.id),
            eq(schema.orders.tableId, tableId),
            sql`NOT EXISTS (
              SELECT 1 FROM ${schema.orderItems}
              WHERE ${schema.orderItems.orderId} = ${schema.orders.id}
                AND ${schema.orderItems.invoiceId} IS NULL
            )`,
          ),
        );

      await tx
        .update(schema.restaurantTables)
        .set({ status: 'billed' })
        .where(eq(schema.restaurantTables.id, tableId));

      await this.tableSessionsService.revokeForTable(tx, business.id, tableId);

      return invoices;
    });
  }

  async closeTable(business: Business, tableId: string): Promise<void> {
    const table = await this.tablesService.getById(business.id, tableId);

    if (table.status !== 'billed') {
      throw new BadRequestException(
        `Table ${table.tableNo} is ${table.status}; only a billed table can be closed`,
      );
    }

    await this.db
      .update(schema.restaurantTables)
      .set({ status: 'empty' })
      .where(eq(schema.restaurantTables.id, tableId));
  }

  private async findUnbilledLines(
    businessId: string,
    tableId: string,
  ): Promise<OrderItem[]> {
    const rows = await this.db
      .select({ item: schema.orderItems })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          eq(schema.orders.tableId, tableId),
          isNull(schema.orderItems.invoiceId),
        ),
      );

    return rows.map((row) => row.item);
  }

  private itemGroups(unbilled: OrderItem[], dto: BillTableDto): OrderItem[][] {
    if (!dto.splits || dto.splits.length === 0) {
      return [unbilled];
    }

    const byId = new Map(unbilled.map((line) => [line.id, line]));
    const seen = new Set<string>();
    const groups: OrderItem[][] = [];

    for (const split of dto.splits) {
      const lines: OrderItem[] = [];

      for (const id of split.orderItemIds) {
        const line = byId.get(id);

        if (!line) {
          throw new NotFoundException(
            `Order item ${id} is not an unbilled line on this table`,
          );
        }

        if (seen.has(id)) {
          throw new BadRequestException(
            `Order item ${id} appears in more than one split`,
          );
        }

        seen.add(id);
        lines.push(line);
      }

      groups.push(lines);
    }

    if (seen.size !== unbilled.length) {
      const missing = unbilled.filter((line) => !seen.has(line.id)).length;
      throw new BadRequestException(
        `${missing} line(s) on this table are not covered by any split`,
      );
    }

    return groups;
  }

  private shareWeights(unbilled: OrderItem[], dto: BillTableDto): number[] {
    if (dto.mode === 'equal') {
      if (!dto.ways) {
        throw new BadRequestException(
          'An equal split needs "ways" — how many people are paying',
        );
      }

      return Array.from({ length: dto.ways }, () => 1);
    }

    if (!dto.percentages || dto.percentages.length === 0) {
      throw new BadRequestException(
        'A percentage split needs "percentages" — one per person',
      );
    }

    const total = dto.percentages.reduce((sum, share) => sum + share, 0);

    if (Math.round(total * 100) !== 10000) {
      throw new BadRequestException(
        `Split percentages must add up to 100, not ${total}`,
      );
    }

    return dto.percentages.map((share) => Math.round(share * 100));
  }

  private resolvePortions(
    unbilled: OrderItem[],
    dto: BillTableDto,
    business: Business,
  ): BillPortion[] {
    const mode = dto.mode ?? 'items';

    const groups =
      mode === 'items' ? this.itemGroups(unbilled, dto) : [unbilled];

    const weights =
      mode === 'items'
        ? groups.map((lines) =>
            lines.reduce(
              (sum, line) => sum + line.lineTotalCents - line.discountCents,
              0,
            ),
          )
        : this.shareWeights(unbilled, dto);

    const subtotal = unbilled.reduce(
      (sum, line) => sum + line.lineTotalCents,
      0,
    );

    const discount = unbilled.reduce(
      (sum, line) => sum + line.discountCents,
      0,
    );

    const serviceCharge = Math.round(
      ((subtotal - discount) * business.serviceChargePercent) / 100,
    );

    const vat = computeVatCents(
      subtotal - discount + serviceCharge,
      business.vatRegistered,
    );

    const charges = apportion(serviceCharge, weights);
    const vats = apportion(vat, weights);

    if (mode === 'items') {
      return groups.map((lines, index) => ({
        lines,
        subtotalCents: lines.reduce(
          (sum, line) => sum + line.lineTotalCents,
          0,
        ),
        discountCents: lines.reduce((sum, line) => sum + line.discountCents, 0),
        serviceChargeCents: charges[index],
        vatCents: vats[index],
      }));
    }

    const subtotals = apportion(subtotal, weights);
    const discounts = apportion(discount, weights);

    return weights.map((_, index) => ({
      lines: index === 0 ? unbilled : [],
      subtotalCents: subtotals[index],
      discountCents: discounts[index],
      serviceChargeCents: charges[index],
      vatCents: vats[index],
    }));
  }
}

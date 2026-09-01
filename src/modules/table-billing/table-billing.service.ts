import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  Business,
  BusinessInvoice,
  OrderItem,
} from '../../database/schema';
import { InvoicesService } from '../invoices/invoices.service';
import { TableSessionsService } from '../table-sessions/table-sessions.service';
import { TablesService } from '../tables/tables.service';
import type { BillTableDto } from './dto/bill-table.dto';

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

    const splits = this.resolveSplits(unbilled, dto);

    return this.db.transaction(async (tx) => {
      const invoices: BusinessInvoice[] = [];

      for (const lines of splits) {
        const subtotalCents = lines.reduce(
          (total, line) => total + line.lineTotalCents,
          0,
        );

        const serviceChargeCents = Math.round(
          (subtotalCents * business.serviceChargePercent) / 100,
        );

        const invoice = await this.invoicesService.issue(tx, {
          business,
          orderId: null,
          subtotalCents,
          serviceChargeCents,
          actorUserId,
        });

        await tx
          .update(schema.orderItems)
          .set({ invoiceId: invoice.id })
          .where(
            and(
              eq(schema.orderItems.businessId, business.id),
              inArray(
                schema.orderItems.id,
                lines.map((line) => line.id),
              ),
            ),
          );

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

  private resolveSplits(
    unbilled: OrderItem[],
    dto: BillTableDto,
  ): OrderItem[][] {
    if (!dto.splits || dto.splits.length === 0) {
      return [unbilled];
    }

    const byId = new Map(unbilled.map((line) => [line.id, line]));
    const seen = new Set<string>();
    const splits: OrderItem[][] = [];

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

      splits.push(lines);
    }

    if (seen.size !== unbilled.length) {
      const missing = unbilled.filter((line) => !seen.has(line.id)).length;
      throw new BadRequestException(
        `${missing} line(s) on this table are not covered by any split`,
      );
    }

    return splits;
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';

export interface LiveSalesTotals {
  invoices: number;
  grossCents: number;
  creditNoteCents: number;
  netCents: number;
  discountCents: number;
  serviceChargeCents: number;
  vatCents: number;
  averageTicketCents: number;
}

export interface LiveSalesHour {
  hour: number;
  invoices: number;
  netCents: number;
}

export interface LiveSalesMethod {
  method: string;
  payments: number;
  amountCents: number;
}

export interface LiveSalesItem {
  name: string;
  quantity: number;
  revenueCents: number;
}

export interface LiveSalesOpen {
  orders: number;
  valueCents: number;
}

export interface LiveSalesReport {
  businessDate: string;
  timezone: string;
  generatedAt: string;
  totals: LiveSalesTotals;
  byHour: LiveSalesHour[];
  byPaymentMethod: LiveSalesMethod[];
  topItems: LiveSalesItem[];
  open: LiveSalesOpen;
}

const TOP_ITEM_LIMIT = 10;

@Injectable()
export class LiveSalesService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getReport(
    businessId: string,
    branchId: string,
    businessDate?: string,
  ): Promise<LiveSalesReport> {
    const timezone = await this.timezoneFor(businessId);
    const day = businessDate ?? (await this.today(timezone));

    const [totals, byHour, byPaymentMethod, topItems, open] = await Promise.all(
      [
        this.totals(businessId, branchId, timezone, day),
        this.byHour(businessId, branchId, timezone, day),
        this.byPaymentMethod(businessId, branchId, timezone, day),
        this.topItems(businessId, branchId, timezone, day),
        this.open(businessId, branchId),
      ],
    );

    return {
      businessDate: day,
      timezone,
      generatedAt: new Date().toISOString(),
      totals,
      byHour,
      byPaymentMethod,
      topItems,
      open,
    };
  }

  private async timezoneFor(businessId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: schema.businessSettings.timezone })
      .from(schema.businessSettings)
      .where(eq(schema.businessSettings.businessId, businessId))
      .limit(1);

    return row?.timezone ?? 'Asia/Kathmandu';
  }

  private async today(timezone: string): Promise<string> {
    const [row] = await this.db.execute<{ day: string }>(
      sql`SELECT to_char((NOW() AT TIME ZONE ${timezone})::date, 'YYYY-MM-DD') AS day`,
    );

    return row.day;
  }

  private onDay(column: unknown, timezone: string, day: string) {
    return sql`(${column} AT TIME ZONE ${timezone})::date = ${day}::date`;
  }

  private async totals(
    businessId: string,
    branchId: string,
    timezone: string,
    day: string,
  ): Promise<LiveSalesTotals> {
    const [row] = await this.db
      .select({
        invoices: sql<string>`COUNT(*) FILTER (WHERE ${schema.businessInvoices.status} = 'issued')`,
        grossCents: sql<string>`COALESCE(SUM(${schema.businessInvoices.totalCents}) FILTER (WHERE ${schema.businessInvoices.status} = 'issued'), 0)`,
        creditNoteCents: sql<string>`COALESCE(SUM(${schema.businessInvoices.totalCents}) FILTER (WHERE ${schema.businessInvoices.status} = 'credit_note'), 0)`,
        discountCents: sql<string>`COALESCE(SUM(${schema.businessInvoices.discountCents}) FILTER (WHERE ${schema.businessInvoices.status} = 'issued'), 0)`,
        serviceChargeCents: sql<string>`COALESCE(SUM(${schema.businessInvoices.serviceChargeCents}) FILTER (WHERE ${schema.businessInvoices.status} = 'issued'), 0)`,
        vatCents: sql<string>`COALESCE(SUM(${schema.businessInvoices.vatCents}) FILTER (WHERE ${schema.businessInvoices.status} = 'issued'), 0)`,
      })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.branchId, branchId),
          this.onDay(schema.businessInvoices.createdAt, timezone, day),
        ),
      );

    const invoices = Number(row?.invoices ?? 0);
    const grossCents = Number(row?.grossCents ?? 0);
    const creditNoteCents = Number(row?.creditNoteCents ?? 0);

    return {
      invoices,
      grossCents,
      creditNoteCents,
      netCents: grossCents - creditNoteCents,
      discountCents: Number(row?.discountCents ?? 0),
      serviceChargeCents: Number(row?.serviceChargeCents ?? 0),
      vatCents: Number(row?.vatCents ?? 0),
      averageTicketCents:
        invoices === 0
          ? 0
          : Math.round((grossCents - creditNoteCents) / invoices),
    };
  }

  private async byHour(
    businessId: string,
    branchId: string,
    timezone: string,
    day: string,
  ): Promise<LiveSalesHour[]> {
    const hour = sql`EXTRACT(HOUR FROM (${schema.businessInvoices.createdAt} AT TIME ZONE ${timezone}))`;

    const rows = await this.db
      .select({
        hour: sql<string>`${hour}`,
        invoices: sql<string>`COUNT(*) FILTER (WHERE ${schema.businessInvoices.status} = 'issued')`,
        netCents: sql<string>`COALESCE(SUM(CASE WHEN ${schema.businessInvoices.status} = 'credit_note' THEN -${schema.businessInvoices.totalCents} ELSE ${schema.businessInvoices.totalCents} END) FILTER (WHERE ${schema.businessInvoices.status} <> 'voided'), 0)`,
      })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.branchId, branchId),
          this.onDay(schema.businessInvoices.createdAt, timezone, day),
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    return rows.map((row) => ({
      hour: Number(row.hour),
      invoices: Number(row.invoices),
      netCents: Number(row.netCents),
    }));
  }

  private async byPaymentMethod(
    businessId: string,
    branchId: string,
    timezone: string,
    day: string,
  ): Promise<LiveSalesMethod[]> {
    const rows = await this.db
      .select({
        method: schema.invoicePayments.method,
        payments: sql<string>`COUNT(*)`,
        amountCents: sql<string>`COALESCE(SUM(${schema.invoicePayments.amountCents}), 0)`,
      })
      .from(schema.invoicePayments)
      .where(
        and(
          eq(schema.invoicePayments.businessId, businessId),
          eq(schema.invoicePayments.branchId, branchId),
          this.onDay(schema.invoicePayments.createdAt, timezone, day),
        ),
      )
      .groupBy(schema.invoicePayments.method)
      .orderBy(
        sql`COALESCE(SUM(${schema.invoicePayments.amountCents}), 0) DESC`,
      );

    return rows.map((row) => ({
      method: row.method,
      payments: Number(row.payments),
      amountCents: Number(row.amountCents),
    }));
  }

  private async topItems(
    businessId: string,
    branchId: string,
    timezone: string,
    day: string,
  ): Promise<LiveSalesItem[]> {
    const rows = await this.db
      .select({
        name: schema.orderItems.productName,
        quantity: sql<string>`SUM(${schema.orderItems.quantity})`,
        revenueCents: sql<string>`SUM(${schema.orderItems.lineTotalCents} - ${schema.orderItems.discountCents})`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          eq(schema.orders.branchId, branchId),
          this.onDay(schema.orders.createdAt, timezone, day),
        ),
      )
      .groupBy(schema.orderItems.productName)
      .orderBy(
        sql`SUM(${schema.orderItems.lineTotalCents} - ${schema.orderItems.discountCents}) DESC`,
      )
      .limit(TOP_ITEM_LIMIT);

    return rows.map((row) => ({
      name: row.name,
      quantity: Number(row.quantity),
      revenueCents: Number(row.revenueCents),
    }));
  }

  private async open(
    businessId: string,
    branchId: string,
  ): Promise<LiveSalesOpen> {
    const [row] = await this.db
      .select({
        orders: sql<string>`COUNT(*)`,
        valueCents: sql<string>`COALESCE(SUM(${schema.orders.totalCents}), 0)`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.branchId, branchId),
          sql`${schema.orders.status} NOT IN ('billed', 'voided')`,
        ),
      );

    return {
      orders: Number(row?.orders ?? 0),
      valueCents: Number(row?.valueCents ?? 0),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';

export interface TableTurnover {
  tableNo: string;
  sittings: number;
  averageMinutes: number;
}

export interface ItemPerformance {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenueCents: number;
  modifierAttachRate: number;
}

export interface HourBucket {
  hour: number;
  orders: number;
}

export interface StuckOrder {
  orderId: string;
  tableNo: string | null;
  status: string;
  minutesInStatus: number;
}

export interface RestaurantAnalytics {
  tableTurnover: TableTurnover[];
  itemPerformance: ItemPerformance[];
  peakHours: HourBucket[];
  stuckOrders: StuckOrder[];
}

const STUCK_THRESHOLD_MINUTES = 20;

@Injectable()
export class RestaurantAnalyticsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getAnalytics(
    businessId: string,
    sinceDays: number,
  ): Promise<RestaurantAnalytics> {
    const since = new Date(Date.now() - sinceDays * 86_400_000);

    const [tableTurnover, itemPerformance, peakHours, stuckOrders] =
      await Promise.all([
        this.tableTurnover(businessId, since),
        this.itemPerformance(businessId, since),
        this.peakHours(businessId, since),
        this.stuckOrders(businessId),
      ]);

    return { tableTurnover, itemPerformance, peakHours, stuckOrders };
  }

  private async tableTurnover(
    businessId: string,
    since: Date,
  ): Promise<TableTurnover[]> {
    const rows = await this.db
      .select({
        tableNo: schema.restaurantTables.tableNo,
        sittings: sql<number>`COUNT(DISTINCT ${schema.orders.id})`,
        averageMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${schema.orders.updatedAt} - ${schema.orders.createdAt})) / 60), 0)`,
      })
      .from(schema.orders)
      .innerJoin(
        schema.restaurantTables,
        eq(schema.restaurantTables.id, schema.orders.tableId),
      )
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.status, 'billed'),
          gte(schema.orders.createdAt, since),
        ),
      )
      .groupBy(schema.restaurantTables.tableNo)
      .orderBy(schema.restaurantTables.tableNo);

    return rows.map((row) => ({
      tableNo: row.tableNo,
      sittings: Number(row.sittings),
      averageMinutes: Math.round(Number(row.averageMinutes)),
    }));
  }

  private async itemPerformance(
    businessId: string,
    since: Date,
  ): Promise<ItemPerformance[]> {
    const rows = await this.db
      .select({
        menuItemId: schema.orderItems.menuItemId,
        name: schema.orderItems.productName,
        quantitySold: sql<string>`SUM(${schema.orderItems.quantity})`,
        revenueCents: sql<number>`SUM(${schema.orderItems.lineTotalCents})`,
        withModifiers: sql<number>`SUM(CASE WHEN jsonb_array_length(${schema.orderItems.modifiers}) > 0 THEN 1 ELSE 0 END)`,
        lines: sql<number>`COUNT(*)`,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          sql`${schema.orderItems.menuItemId} IS NOT NULL`,
          gte(schema.orders.createdAt, since),
        ),
      )
      .groupBy(schema.orderItems.menuItemId, schema.orderItems.productName)
      .orderBy(sql`SUM(${schema.orderItems.lineTotalCents}) DESC`);

    return rows.map((row) => ({
      menuItemId: row.menuItemId ?? '',
      name: row.name,
      quantitySold: Number(row.quantitySold),
      revenueCents: Number(row.revenueCents),
      modifierAttachRate:
        Number(row.lines) === 0
          ? 0
          : Number((Number(row.withModifiers) / Number(row.lines)).toFixed(2)),
    }));
  }

  private async peakHours(
    businessId: string,
    since: Date,
  ): Promise<HourBucket[]> {
    const rows = await this.db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${schema.orders.createdAt})`,
        orders: sql<number>`COUNT(*)`,
      })
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          gte(schema.orders.createdAt, since),
        ),
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${schema.orders.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${schema.orders.createdAt})`);

    return rows.map((row) => ({
      hour: Number(row.hour),
      orders: Number(row.orders),
    }));
  }

  private async stuckOrders(businessId: string): Promise<StuckOrder[]> {
    const rows = await this.db
      .select({
        orderId: schema.orders.id,
        tableNo: schema.restaurantTables.tableNo,
        status: schema.orders.status,
        minutes: sql<number>`EXTRACT(EPOCH FROM (NOW() - ${schema.orders.updatedAt})) / 60`,
      })
      .from(schema.orders)
      .leftJoin(
        schema.restaurantTables,
        eq(schema.restaurantTables.id, schema.orders.tableId),
      )
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          sql`${schema.orders.status} <> 'billed'`,
          sql`${schema.orders.updatedAt} < NOW() - INTERVAL '${sql.raw(String(STUCK_THRESHOLD_MINUTES))} minutes'`,
        ),
      )
      .orderBy(schema.orders.updatedAt);

    return rows.map((row) => ({
      orderId: row.orderId,
      tableNo: row.tableNo,
      status: row.status,
      minutesInStatus: Math.round(Number(row.minutes)),
    }));
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';

export interface ProfitLine {
  productId: string | null;
  name: string;
  quantity: number;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  marginPercent: number;
}

export interface ProfitReport {
  from: string;
  to: string;
  totals: {
    revenueCents: number;
    costCents: number;
    profitCents: number;
    marginPercent: number;
  };
  lines: ProfitLine[];
  uncosted: number;
}

function margin(revenueCents: number, profitCents: number): number {
  if (revenueCents === 0) {
    return 0;
  }

  return Number(((profitCents / revenueCents) * 100).toFixed(2));
}

@Injectable()
export class ProfitService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getReport(
    businessId: string,
    branchId: string,
    from: Date,
    to: Date,
  ): Promise<ProfitReport> {
    const where = and(
      eq(schema.orderItems.businessId, businessId),
      eq(schema.orders.branchId, branchId),
      gte(schema.orders.createdAt, from),
      lte(schema.orders.createdAt, to),
      sql`${schema.orders.status} <> 'voided'`,
    );

    const revenue = sql<string>`SUM(${schema.orderItems.lineTotalCents} - ${schema.orderItems.discountCents})`;
    const cost = sql<string>`SUM(ROUND(${schema.orderItems.unitCostCents} * ${schema.orderItems.quantity}))`;

    const [rows, [uncosted]] = await Promise.all([
      this.db
        .select({
          productId: schema.orderItems.productId,
          name: schema.orderItems.productName,
          quantity: sql<string>`SUM(${schema.orderItems.quantity})`,
          revenueCents: revenue,
          costCents: cost,
        })
        .from(schema.orderItems)
        .innerJoin(
          schema.orders,
          eq(schema.orders.id, schema.orderItems.orderId),
        )
        .where(where)
        .groupBy(schema.orderItems.productId, schema.orderItems.productName)
        .orderBy(sql`${revenue} - ${cost} DESC`),
      this.db
        .select({ value: sql<string>`COUNT(*)` })
        .from(schema.orderItems)
        .innerJoin(
          schema.orders,
          eq(schema.orders.id, schema.orderItems.orderId),
        )
        .where(and(where, eq(schema.orderItems.unitCostCents, 0))),
    ]);

    const lines = rows.map((row) => {
      const revenueCents = Number(row.revenueCents);
      const costCents = Number(row.costCents);
      const profitCents = revenueCents - costCents;

      return {
        productId: row.productId,
        name: row.name,
        quantity: Number(row.quantity),
        revenueCents,
        costCents,
        profitCents,
        marginPercent: margin(revenueCents, profitCents),
      };
    });

    const revenueCents = lines.reduce(
      (sum, line) => sum + line.revenueCents,
      0,
    );
    const costCents = lines.reduce((sum, line) => sum + line.costCents, 0);
    const profitCents = revenueCents - costCents;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        revenueCents,
        costCents,
        profitCents,
        marginPercent: margin(revenueCents, profitCents),
      },
      lines,
      uncosted: Number(uncosted?.value ?? 0),
    };
  }
}

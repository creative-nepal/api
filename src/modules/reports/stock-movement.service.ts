import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';

export const MOVEMENT_SOURCES = [
  'purchase',
  'sale',
  'wastage',
  'adjustment',
] as const;
export type MovementSource = (typeof MOVEMENT_SOURCES)[number];

export interface StockMovement {
  id: string;
  at: string;
  source: MovementSource;
  reference: string | null;
  note: string | null;
  quantity: number;
  runningQty: number;
}

export interface StockMovementReport {
  productId: string;
  name: string;
  unitType: string;
  from: string;
  to: string;
  openingQty: number;
  closingQty: number;
  inQty: number;
  outQty: number;
  movements: StockMovement[];
}

@Injectable()
export class StockMovementService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getReport(
    businessId: string,
    productId: string,
    from: Date,
    to: Date,
  ): Promise<StockMovementReport> {
    const [product] = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
        ),
      )
      .limit(1);

    if (!product) {
      throw new NotFoundException({
        message: 'i18n:errors.product.notFound',
        productId,
      });
    }

    const all = await this.collect(businessId, productId);

    const after = all
      .filter((entry) => entry.at > to)
      .reduce((sum, entry) => sum + entry.quantity, 0);

    const within = all
      .filter((entry) => entry.at >= from && entry.at <= to)
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    const closingQty = Number((Number(product.stockQty) - after).toFixed(3));

    const movedInWindow = within.reduce(
      (sum, entry) => sum + entry.quantity,
      0,
    );

    const openingQty = Number((closingQty - movedInWindow).toFixed(3));

    let running = openingQty;
    const movements = within.map((entry) => {
      running = Number((running + entry.quantity).toFixed(3));

      return {
        id: entry.id,
        at: entry.at.toISOString(),
        source: entry.source,
        reference: entry.reference,
        note: entry.note,
        quantity: entry.quantity,
        runningQty: running,
      };
    });

    return {
      productId,
      name: product.name,
      unitType: product.unitType,
      from: from.toISOString(),
      to: to.toISOString(),
      openingQty,
      closingQty,
      inQty: Number(
        within
          .filter((entry) => entry.quantity > 0)
          .reduce((sum, entry) => sum + entry.quantity, 0)
          .toFixed(3),
      ),
      outQty: Number(
        Math.abs(
          within
            .filter((entry) => entry.quantity < 0)
            .reduce((sum, entry) => sum + entry.quantity, 0),
        ).toFixed(3),
      ),
      movements,
    };
  }

  private async collect(
    businessId: string,
    productId: string,
  ): Promise<
    Array<{
      id: string;
      at: Date;
      source: MovementSource;
      reference: string | null;
      note: string | null;
      quantity: number;
    }>
  > {
    const [purchases, sales, wastage, adjustments] = await Promise.all([
      this.db
        .select({
          id: schema.purchaseBillItems.id,
          at: schema.purchaseBills.createdAt,
          reference: schema.purchaseBills.billNumber,
          quantity: schema.purchaseBillItems.quantity,
        })
        .from(schema.purchaseBillItems)
        .innerJoin(
          schema.purchaseBills,
          eq(schema.purchaseBills.id, schema.purchaseBillItems.purchaseBillId),
        )
        .where(
          and(
            eq(schema.purchaseBillItems.businessId, businessId),
            eq(schema.purchaseBillItems.productId, productId),
          ),
        ),
      this.db
        .select({
          id: schema.orderItems.id,
          at: schema.orders.createdAt,
          reference: schema.orders.id,
          quantity: schema.orderItems.quantity,
        })
        .from(schema.orderItems)
        .innerJoin(
          schema.orders,
          eq(schema.orders.id, schema.orderItems.orderId),
        )
        .where(
          and(
            eq(schema.orderItems.businessId, businessId),
            eq(schema.orderItems.productId, productId),
            sql`${schema.orders.status} <> 'voided'`,
          ),
        ),
      this.db
        .select({
          id: schema.wastageRecords.id,
          at: schema.wastageRecords.createdAt,
          reference: schema.wastageRecords.reason,
          quantity: schema.wastageRecords.quantity,
        })
        .from(schema.wastageRecords)
        .where(
          and(
            eq(schema.wastageRecords.businessId, businessId),
            eq(schema.wastageRecords.productId, productId),
          ),
        ),
      this.db
        .select({
          id: schema.stockAdjustments.id,
          at: schema.stockAdjustments.createdAt,
          reference: schema.stockAdjustments.reason,
          note: schema.stockAdjustments.note,
          quantity: schema.stockAdjustments.delta,
        })
        .from(schema.stockAdjustments)
        .where(
          and(
            eq(schema.stockAdjustments.businessId, businessId),
            eq(schema.stockAdjustments.productId, productId),
          ),
        ),
    ]);

    return [
      ...purchases.map((row) => ({
        id: row.id,
        at: row.at,
        source: 'purchase' as const,
        reference: row.reference,
        note: null,
        quantity: Number(row.quantity),
      })),
      ...sales.map((row) => ({
        id: row.id,
        at: row.at,
        source: 'sale' as const,
        reference: row.reference,
        note: null,
        quantity: -Number(row.quantity),
      })),
      ...wastage.map((row) => ({
        id: row.id,
        at: row.at,
        source: 'wastage' as const,
        reference: row.reference,
        note: null,
        quantity: -Number(row.quantity),
      })),
      ...adjustments.map((row) => ({
        id: row.id,
        at: row.at,
        source: 'adjustment' as const,
        reference: row.reference,
        note: row.note,
        quantity: Number(row.quantity),
      })),
    ];
  }
}

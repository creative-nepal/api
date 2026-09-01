import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, gt, gte, lte, sql } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type { NewProductBatch, ProductBatch } from '../../database/schema';

@Injectable()
export class BatchesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(
    businessId: string,
    id: string,
  ): Promise<ProductBatch | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findByProduct(
    businessId: string,
    productId: string,
  ): Promise<ProductBatch[]> {
    return this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.productId, productId),
        ),
      )
      .orderBy(asc(schema.productBatches.expiryDate));
  }

  async findDispensable(
    executor: DatabaseExecutor,
    businessId: string,
    productId: string,
  ): Promise<ProductBatch[]> {
    return executor
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.productId, productId),
          eq(schema.productBatches.isActive, true),
          gt(schema.productBatches.qty, '0'),
          gt(schema.productBatches.expiryDate, sql`CURRENT_DATE`),
        ),
      )
      .orderBy(asc(schema.productBatches.expiryDate));
  }

  async findExpiring(
    businessId: string,
    fromDate: string,
    toDate: string,
    filters: {
      limit: number;
      offset: number;
      sortBy?: string;
      sortDirection: SortDirection;
    },
  ): Promise<{ data: ProductBatch[]; total: number }> {
    const where = and(
      eq(schema.productBatches.businessId, businessId),
      eq(schema.productBatches.isActive, true),
      gt(schema.productBatches.qty, '0'),
      gte(schema.productBatches.expiryDate, fromDate),
      lte(schema.productBatches.expiryDate, toDate),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.productBatches)
        .where(where)
        .orderBy(
          resolveOrderBy(
            {
              expiryDate: schema.productBatches.expiryDate,
              batchNo: schema.productBatches.batchNo,
              qty: schema.productBatches.qty,
            },
            filters.sortBy,
            filters.sortDirection,
            schema.productBatches.expiryDate,
          ),
        )
        .limit(filters.limit)
        .offset(filters.offset),
      this.db
        .select({ value: count() })
        .from(schema.productBatches)
        .where(where),
    ]);

    return { data, total: total?.value ?? 0 };
  }

  async findByBatchNo(
    businessId: string,
    productId: string,
    batchNo: string,
  ): Promise<ProductBatch | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.productId, productId),
          eq(schema.productBatches.batchNo, batchNo),
        ),
      )
      .limit(1);
    return row;
  }

  async insert(
    executor: DatabaseExecutor,
    values: NewProductBatch,
  ): Promise<ProductBatch> {
    const [row] = await executor
      .insert(schema.productBatches)
      .values(values)
      .returning();
    return row;
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<Omit<ProductBatch, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<ProductBatch | undefined> {
    const [row] = await this.db
      .update(schema.productBatches)
      .set(patch)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.id, id),
        ),
      )
      .returning();
    return row;
  }

  async decrementQty(
    executor: DatabaseExecutor,
    businessId: string,
    batchId: string,
    quantity: string,
  ): Promise<ProductBatch | undefined> {
    const [row] = await executor
      .update(schema.productBatches)
      .set({ qty: sql`${schema.productBatches.qty} - ${quantity}::numeric` })
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.id, batchId),
          eq(schema.productBatches.isActive, true),
          gte(schema.productBatches.qty, quantity),
          gt(schema.productBatches.expiryDate, sql`CURRENT_DATE`),
        ),
      )
      .returning();
    return row;
  }

  async adjustQty(
    executor: DatabaseExecutor,
    businessId: string,
    batchId: string,
    delta: string,
  ): Promise<ProductBatch | undefined> {
    const [row] = await executor
      .update(schema.productBatches)
      .set({
        qty: sql`GREATEST(${schema.productBatches.qty} + ${delta}::numeric, 0)`,
      })
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.id, batchId),
        ),
      )
      .returning();
    return row;
  }

  async syncProductStock(
    executor: DatabaseExecutor,
    businessId: string,
    productId: string,
  ): Promise<void> {
    await executor
      .update(schema.products)
      .set({
        stockQty: sql`COALESCE((
          SELECT SUM(${schema.productBatches.qty})
          FROM ${schema.productBatches}
          WHERE ${schema.productBatches.businessId} = ${businessId}
            AND ${schema.productBatches.productId} = ${productId}
            AND ${schema.productBatches.isActive} = true
            AND ${schema.productBatches.expiryDate} > CURRENT_DATE
        ), 0)`,
      })
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
        ),
      );
  }
}

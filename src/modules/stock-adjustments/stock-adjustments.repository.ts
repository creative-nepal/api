import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  NewStockAdjustment,
  StockAdjustment,
} from '../../database/schema';

export interface ListStockAdjustmentsFilters {
  businessId: string;
  limit: number;
  offset: number;
  productId?: string;
  reason?: string;
}

@Injectable()
export class StockAdjustmentsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async insert(
    executor: DatabaseExecutor,
    values: NewStockAdjustment,
  ): Promise<StockAdjustment> {
    const [row] = await executor
      .insert(schema.stockAdjustments)
      .values(values)
      .returning();
    return row;
  }

  async findMany(
    filters: ListStockAdjustmentsFilters,
  ): Promise<StockAdjustment[]> {
    return this.db
      .select()
      .from(schema.stockAdjustments)
      .where(this.buildWhere(filters))
      .orderBy(desc(schema.stockAdjustments.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListStockAdjustmentsFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.stockAdjustments)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  private buildWhere(filters: ListStockAdjustmentsFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.stockAdjustments.businessId, filters.businessId),
    ];

    if (filters.productId) {
      conditions.push(eq(schema.stockAdjustments.productId, filters.productId));
    }

    if (filters.reason) {
      conditions.push(eq(schema.stockAdjustments.reason, filters.reason));
    }

    return and(...conditions);
  }
}

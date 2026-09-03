import { Injectable } from '@nestjs/common';
import { and, count, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import type {
  NewStockTake,
  NewStockTakeLine,
  StockTake,
  StockTakeLine,
  StockTakeStatus,
} from '../../database/schema';

const SORTABLE = {
  reference: schema.stockTakes.reference,
  status: schema.stockTakes.status,
  createdAt: schema.stockTakes.createdAt,
  closedAt: schema.stockTakes.closedAt,
};

export interface ListStockTakesFilters {
  businessId: string;
  branchId?: string;
  status?: StockTakeStatus;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
}

export interface CountableSnapshotRow {
  productId: string;
  productName: string;
  batchId: string | null;
  batchNo: string | null;
  systemQty: string;
}

@Injectable()
export class StockTakesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async insert(
    executor: DatabaseExecutor,
    values: NewStockTake,
  ): Promise<StockTake> {
    const [row] = await executor
      .insert(schema.stockTakes)
      .values(values)
      .returning();
    return row;
  }

  async insertLines(
    executor: DatabaseExecutor,
    values: NewStockTakeLine[],
  ): Promise<StockTakeLine[]> {
    if (values.length === 0) {
      return [];
    }

    return executor.insert(schema.stockTakeLines).values(values).returning();
  }

  async findById(
    businessId: string,
    id: string,
  ): Promise<StockTake | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.stockTakes)
      .where(
        and(
          eq(schema.stockTakes.businessId, businessId),
          eq(schema.stockTakes.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findOpenForBranch(
    businessId: string,
    branchId: string,
  ): Promise<StockTake | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.stockTakes)
      .where(
        and(
          eq(schema.stockTakes.businessId, businessId),
          eq(schema.stockTakes.branchId, branchId),
          eq(schema.stockTakes.status, 'open'),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListStockTakesFilters): Promise<StockTake[]> {
    return this.db
      .select()
      .from(schema.stockTakes)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.stockTakes.createdAt,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListStockTakesFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.stockTakes)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findLines(
    businessId: string,
    stockTakeId: string,
  ): Promise<StockTakeLine[]> {
    return this.db
      .select()
      .from(schema.stockTakeLines)
      .where(
        and(
          eq(schema.stockTakeLines.businessId, businessId),
          eq(schema.stockTakeLines.stockTakeId, stockTakeId),
        ),
      )
      .orderBy(
        schema.stockTakeLines.productName,
        schema.stockTakeLines.batchNo,
      );
  }

  async findLinesByIds(
    businessId: string,
    stockTakeId: string,
    ids: string[],
  ): Promise<StockTakeLine[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .select()
      .from(schema.stockTakeLines)
      .where(
        and(
          eq(schema.stockTakeLines.businessId, businessId),
          eq(schema.stockTakeLines.stockTakeId, stockTakeId),
          inArray(schema.stockTakeLines.id, ids),
        ),
      );
  }

  async recordCount(
    executor: DatabaseExecutor,
    businessId: string,
    lineId: string,
    countedQty: string,
    actorUserId: string,
  ): Promise<void> {
    await executor
      .update(schema.stockTakeLines)
      .set({ countedQty, countedByUserId: actorUserId, countedAt: new Date() })
      .where(
        and(
          eq(schema.stockTakeLines.businessId, businessId),
          eq(schema.stockTakeLines.id, lineId),
        ),
      );
  }

  async close(
    executor: DatabaseExecutor,
    businessId: string,
    id: string,
    status: StockTakeStatus,
    actorUserId: string,
    note: string | null,
  ): Promise<StockTake | undefined> {
    const [row] = await executor
      .update(schema.stockTakes)
      .set({
        status,
        closedByUserId: actorUserId,
        closedAt: new Date(),
        ...(note === null ? {} : { note }),
      })
      .where(
        and(
          eq(schema.stockTakes.businessId, businessId),
          eq(schema.stockTakes.id, id),
          eq(schema.stockTakes.status, 'open'),
        ),
      )
      .returning();
    return row;
  }

  async snapshotProducts(
    businessId: string,
    branchId: string,
    productIds: string[] | undefined,
  ): Promise<CountableSnapshotRow[]> {
    const conditions: SQL[] = [eq(schema.products.businessId, businessId)];

    if (productIds?.length) {
      conditions.push(inArray(schema.products.id, productIds));
    }

    const rows = await this.db
      .select({
        productId: schema.products.id,
        productName: schema.products.name,
        systemQty: sql<string>`coalesce(${schema.productBranchStock.stockQty}, '0')`,
      })
      .from(schema.products)
      .leftJoin(
        schema.productBranchStock,
        and(
          eq(schema.productBranchStock.productId, schema.products.id),
          eq(schema.productBranchStock.branchId, branchId),
        ),
      )
      .where(and(...conditions));

    return rows.map((row) => ({
      ...row,
      batchId: null,
      batchNo: null,
    }));
  }

  async snapshotBatches(
    businessId: string,
    productIds: string[] | undefined,
  ): Promise<CountableSnapshotRow[]> {
    const conditions: SQL[] = [
      eq(schema.productBatches.businessId, businessId),
      eq(schema.productBatches.isActive, true),
    ];

    if (productIds?.length) {
      conditions.push(inArray(schema.productBatches.productId, productIds));
    }

    return this.db
      .select({
        productId: schema.productBatches.productId,
        productName: schema.products.name,
        batchId: schema.productBatches.id,
        batchNo: schema.productBatches.batchNo,
        systemQty: schema.productBatches.qty,
      })
      .from(schema.productBatches)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.productBatches.productId),
      )
      .where(and(...conditions));
  }

  async countUncounted(
    businessId: string,
    stockTakeId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.stockTakeLines)
      .where(
        and(
          eq(schema.stockTakeLines.businessId, businessId),
          eq(schema.stockTakeLines.stockTakeId, stockTakeId),
          isNull(schema.stockTakeLines.countedQty),
        ),
      );
    return row?.value ?? 0;
  }

  private buildWhere(filters: ListStockTakesFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.stockTakes.businessId, filters.businessId),
    ];

    if (filters.branchId) {
      conditions.push(eq(schema.stockTakes.branchId, filters.branchId));
    }

    if (filters.status) {
      conditions.push(eq(schema.stockTakes.status, filters.status));
    }

    return and(...conditions);
  }
}

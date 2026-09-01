import { Injectable } from '@nestjs/common';
import { and, count, eq, gte, ilike, or, type SQL, sql } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type { NewProduct, Product } from '../../database/schema';

export interface ListProductsFilters {
  businessId: string;
  limit: number;
  offset: number;
  search?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
  sortBy?: string;
  sortDirection: SortDirection;
}

const SORTABLE = {
  name: schema.products.name,
  sku: schema.products.sku,
  priceCents: schema.products.priceCents,
  costPriceCents: schema.products.costPriceCents,
  stockQty: schema.products.stockQty,
  createdAt: schema.products.createdAt,
};

@Injectable()
export class ProductsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(businessId: string, id: string): Promise<Product | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findBySku(
    businessId: string,
    sku: string,
  ): Promise<Product | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.sku, sku),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListProductsFilters): Promise<Product[]> {
    return this.db
      .select()
      .from(schema.products)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.products.name,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListProductsFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.products)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async countForBusiness(businessId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.products)
      .where(eq(schema.products.businessId, businessId));
    return row?.value ?? 0;
  }

  async insert(values: NewProduct): Promise<Product> {
    const [row] = await this.db
      .insert(schema.products)
      .values(values)
      .returning();
    return row;
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<Omit<Product, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<Product | undefined> {
    const [row] = await this.db
      .update(schema.products)
      .set(patch)
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, id),
        ),
      )
      .returning();
    return row;
  }

  async decrementStock(
    executor: DatabaseExecutor,
    businessId: string,
    productId: string,
    quantity: string,
  ): Promise<Product | undefined> {
    const [row] = await executor
      .update(schema.products)
      .set({
        stockQty: sql`${schema.products.stockQty} - ${quantity}::numeric`,
      })
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, productId),
          eq(schema.products.isActive, true),
          gte(schema.products.stockQty, quantity),
        ),
      )
      .returning();
    return row;
  }

  async adjustStockQty(
    executor: DatabaseExecutor,
    businessId: string,
    id: string,
    delta: string,
  ): Promise<Product | undefined> {
    const [row] = await executor
      .update(schema.products)
      .set({
        stockQty: sql`GREATEST(${schema.products.stockQty} + ${delta}::numeric, 0)`,
      })
      .where(
        and(
          eq(schema.products.businessId, businessId),
          eq(schema.products.id, id),
        ),
      )
      .returning();
    return row;
  }

  private buildWhere(filters: ListProductsFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.products.businessId, filters.businessId),
    ];

    if (filters.isActive !== undefined) {
      conditions.push(eq(schema.products.isActive, filters.isActive));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      const match = or(
        ilike(schema.products.name, term),
        ilike(schema.products.sku, term),
      );
      if (match) {
        conditions.push(match);
      }
    }

    if (filters.lowStockOnly) {
      conditions.push(
        sql`${schema.products.stockQty} <= ${schema.products.lowStockThreshold}`,
      );
    }

    return and(...conditions);
  }
}

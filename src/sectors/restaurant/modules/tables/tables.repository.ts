import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../../../database';
import type {
  NewRestaurantTable,
  RestaurantTable,
} from '../../../../database/schema';

export interface ListTablesFilters {
  businessId: string;
  limit: number;
  offset: number;
  status?: string;
}

@Injectable()
export class TablesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(
    businessId: string,
    id: string,
  ): Promise<RestaurantTable | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.restaurantTables)
      .where(
        and(
          eq(schema.restaurantTables.businessId, businessId),
          eq(schema.restaurantTables.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findByTableNo(
    businessId: string,
    tableNo: string,
  ): Promise<RestaurantTable | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.restaurantTables)
      .where(
        and(
          eq(schema.restaurantTables.businessId, businessId),
          eq(schema.restaurantTables.tableNo, tableNo),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListTablesFilters): Promise<RestaurantTable[]> {
    return this.db
      .select()
      .from(schema.restaurantTables)
      .where(this.buildWhere(filters))
      .orderBy(asc(schema.restaurantTables.tableNo))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListTablesFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.restaurantTables)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async insert(values: NewRestaurantTable): Promise<RestaurantTable> {
    const [row] = await this.db
      .insert(schema.restaurantTables)
      .values(values)
      .returning();
    return row;
  }

  async update(
    executor: DatabaseExecutor,
    businessId: string,
    id: string,
    patch: Partial<Omit<RestaurantTable, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<RestaurantTable | undefined> {
    const [row] = await executor
      .update(schema.restaurantTables)
      .set(patch)
      .where(
        and(
          eq(schema.restaurantTables.businessId, businessId),
          eq(schema.restaurantTables.id, id),
        ),
      )
      .returning();
    return row;
  }

  private buildWhere(filters: ListTablesFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.restaurantTables.businessId, filters.businessId),
    ];

    if (filters.status) {
      conditions.push(eq(schema.restaurantTables.status, filters.status));
    }

    return and(...conditions);
  }
}

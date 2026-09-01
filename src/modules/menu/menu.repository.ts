import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { MenuItem, NewMenuItem } from '../../database/schema';

export interface ListMenuFilters {
  businessId: string;
  limit: number;
  offset: number;
  category?: string;
  availableOnly?: boolean;
}

@Injectable()
export class MenuRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(
    businessId: string,
    id: string,
  ): Promise<MenuItem | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.menuItems)
      .where(
        and(
          eq(schema.menuItems.businessId, businessId),
          eq(schema.menuItems.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListMenuFilters): Promise<MenuItem[]> {
    return this.db
      .select()
      .from(schema.menuItems)
      .where(this.buildWhere(filters))
      .orderBy(asc(schema.menuItems.category), asc(schema.menuItems.name))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListMenuFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.menuItems)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async insert(values: NewMenuItem): Promise<MenuItem> {
    const [row] = await this.db
      .insert(schema.menuItems)
      .values(values)
      .returning();
    return row;
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<Omit<MenuItem, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<MenuItem | undefined> {
    const [row] = await this.db
      .update(schema.menuItems)
      .set(patch)
      .where(
        and(
          eq(schema.menuItems.businessId, businessId),
          eq(schema.menuItems.id, id),
        ),
      )
      .returning();
    return row;
  }

  private buildWhere(filters: ListMenuFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.menuItems.businessId, filters.businessId),
    ];

    if (filters.category) {
      conditions.push(eq(schema.menuItems.category, filters.category));
    }

    if (filters.availableOnly) {
      conditions.push(eq(schema.menuItems.isAvailable, true));
    }

    return and(...conditions);
  }
}

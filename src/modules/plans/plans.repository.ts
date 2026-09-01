import { Injectable } from '@nestjs/common';
import { and, count, eq, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import { type Database, InjectDatabase, schema } from '../../database';
import type { NewPlan, Plan, Sector } from '../../database/schema';

export interface ListPlansFilters {
  limit: number;
  offset: number;
  sector?: Sector;
  isActive?: boolean;
  sortBy?: string;
  sortDirection: SortDirection;
}

const SORTABLE = {
  name: schema.plans.name,
  sector: schema.plans.sector,
  priceCents: schema.plans.priceCents,
  isActive: schema.plans.isActive,
  createdAt: schema.plans.createdAt,
};

@Injectable()
export class PlansRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(id: string): Promise<Plan | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, id))
      .limit(1);
    return row;
  }

  async findBySectorAndKey(
    sector: string,
    key: string,
  ): Promise<Plan | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.plans)
      .where(and(eq(schema.plans.sector, sector), eq(schema.plans.key, key)))
      .limit(1);
    return row;
  }

  async findMany(filters: ListPlansFilters): Promise<Plan[]> {
    return this.db
      .select()
      .from(schema.plans)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.plans.priceCents,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListPlansFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.plans)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async insert(values: NewPlan): Promise<Plan> {
    const [row] = await this.db.insert(schema.plans).values(values).returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<Omit<Plan, 'id' | 'sector' | 'key' | 'createdAt'>>,
  ): Promise<Plan | undefined> {
    const [row] = await this.db
      .update(schema.plans)
      .set(patch)
      .where(eq(schema.plans.id, id))
      .returning();
    return row;
  }

  private buildWhere(filters: ListPlansFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.sector) {
      conditions.push(eq(schema.plans.sector, filters.sector));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(schema.plans.isActive, filters.isActive));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

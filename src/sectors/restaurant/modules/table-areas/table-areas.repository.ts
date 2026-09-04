import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { NewTableArea, TableArea } from '../../../../database/schema';

export interface ListTableAreasFilters {
  businessId: string;
  branchId?: string;
  limit: number;
  offset: number;
  isActive?: boolean;
}

@Injectable()
export class TableAreasRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(
    businessId: string,
    id: string,
  ): Promise<TableArea | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.tableAreas)
      .where(
        and(
          eq(schema.tableAreas.businessId, businessId),
          eq(schema.tableAreas.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findByName(
    branchId: string,
    name: string,
  ): Promise<TableArea | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.tableAreas)
      .where(
        and(
          eq(schema.tableAreas.branchId, branchId),
          eq(schema.tableAreas.name, name),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListTableAreasFilters): Promise<TableArea[]> {
    return this.db
      .select()
      .from(schema.tableAreas)
      .where(this.buildWhere(filters))
      .orderBy(asc(schema.tableAreas.sortOrder), asc(schema.tableAreas.name))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListTableAreasFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.tableAreas)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async countTables(areaIds: string[]): Promise<Map<string, number>> {
    if (areaIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        areaId: schema.restaurantTables.areaId,
        value: count(),
      })
      .from(schema.restaurantTables)
      .where(inArray(schema.restaurantTables.areaId, areaIds))
      .groupBy(schema.restaurantTables.areaId);

    return new Map(
      rows.flatMap((row) => (row.areaId ? [[row.areaId, row.value]] : [])),
    );
  }

  async insert(values: NewTableArea): Promise<TableArea> {
    const [row] = await this.db
      .insert(schema.tableAreas)
      .values(values)
      .returning();
    return row;
  }

  async update(
    businessId: string,
    id: string,
    patch: Partial<Omit<TableArea, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<TableArea | undefined> {
    const [row] = await this.db
      .update(schema.tableAreas)
      .set(patch)
      .where(
        and(
          eq(schema.tableAreas.businessId, businessId),
          eq(schema.tableAreas.id, id),
        ),
      )
      .returning();
    return row;
  }

  async remove(businessId: string, id: string): Promise<TableArea | undefined> {
    const [row] = await this.db
      .delete(schema.tableAreas)
      .where(
        and(
          eq(schema.tableAreas.businessId, businessId),
          eq(schema.tableAreas.id, id),
        ),
      )
      .returning();
    return row;
  }

  private buildWhere(filters: ListTableAreasFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.tableAreas.businessId, filters.businessId),
    ];

    if (filters.branchId) {
      conditions.push(eq(schema.tableAreas.branchId, filters.branchId));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(schema.tableAreas.isActive, filters.isActive));
    }

    return and(...conditions);
  }
}

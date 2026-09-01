import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, BusinessStatus, Sector } from '../../database/schema';

export interface ListBusinessesFilters {
  limit: number;
  offset: number;
  sector?: Sector;
  status?: BusinessStatus;
  search?: string;
  sortBy?: string;
  sortDirection: SortDirection;
}

const SORTABLE = {
  legalName: schema.businesses.legalName,
  sector: schema.businesses.sector,
  status: schema.businesses.status,
  createdAt: schema.businesses.createdAt,
};

@Injectable()
export class BusinessesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findById(id: string): Promise<Business | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, id))
      .limit(1);
    return row;
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<Business | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.organizationId, organizationId))
      .limit(1);
    return row;
  }

  async findMany(filters: ListBusinessesFilters): Promise<Business[]> {
    return this.db
      .select()
      .from(schema.businesses)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.businesses.createdAt,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListBusinessesFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businesses)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findManyForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<Business[]> {
    const rows = await this.db
      .select({ business: schema.businesses })
      .from(schema.businesses)
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.organizationId, schema.businesses.organizationId),
          eq(schema.member.userId, userId),
        ),
      )
      .orderBy(desc(schema.businesses.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => row.business);
  }

  async countForUser(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businesses)
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.organizationId, schema.businesses.organizationId),
          eq(schema.member.userId, userId),
        ),
      );
    return row?.value ?? 0;
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Business,
        | 'legalName'
        | 'panNumber'
        | 'vatRegistered'
        | 'cbmsRequired'
        | 'fiscalYearStartMonth'
        | 'status'
      >
    >,
  ): Promise<Business | undefined> {
    const [row] = await this.db
      .update(schema.businesses)
      .set(patch)
      .where(eq(schema.businesses.id, id))
      .returning();
    return row;
  }

  private buildWhere(filters: ListBusinessesFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.sector) {
      conditions.push(eq(schema.businesses.sector, filters.sector));
    }

    if (filters.status) {
      conditions.push(eq(schema.businesses.status, filters.status));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      const match = or(
        ilike(schema.businesses.legalName, term),
        ilike(schema.businesses.panNumber, term),
      );
      if (match) {
        conditions.push(match);
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

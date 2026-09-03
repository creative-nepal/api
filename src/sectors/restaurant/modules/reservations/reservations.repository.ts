import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  eq,
  gte,
  inArray,
  lt,
  lte,
  ne,
  type SQL,
  sql,
} from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../../../database';
import type { SortDirection } from '../../../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../../../common/repository/sorting';
import type { NewReservation, Reservation } from '../../../../database/schema';

const SORTABLE = {
  reservedFor: schema.reservations.reservedFor,
  guestName: schema.reservations.guestName,
  partySize: schema.reservations.partySize,
  status: schema.reservations.status,
  createdAt: schema.reservations.createdAt,
};

const HOLDS_A_TABLE = ['booked', 'seated'];

export interface ListReservationsFilters {
  businessId: string;
  branchId?: string;
  status?: string;
  tableId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
}

@Injectable()
export class ReservationsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async insert(values: NewReservation): Promise<Reservation> {
    const [row] = await this.db
      .insert(schema.reservations)
      .values(values)
      .returning();
    return row;
  }

  async findById(
    businessId: string,
    id: string,
  ): Promise<Reservation | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.businessId, businessId),
          eq(schema.reservations.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListReservationsFilters): Promise<Reservation[]> {
    return this.db
      .select()
      .from(schema.reservations)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.reservations.reservedFor,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListReservationsFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.reservations)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findOverlapping(
    businessId: string,
    tableId: string,
    startsAt: Date,
    endsAt: Date,
    ignoreReservationId?: string,
  ): Promise<Reservation | undefined> {
    const conditions: SQL[] = [
      eq(schema.reservations.businessId, businessId),
      eq(schema.reservations.tableId, tableId),
      inArray(schema.reservations.status, HOLDS_A_TABLE),
      lt(schema.reservations.reservedFor, endsAt),
      sql`${schema.reservations.reservedFor} + make_interval(mins => ${schema.reservations.durationMinutes}) > ${startsAt.toISOString()}::timestamptz`,
    ];

    if (ignoreReservationId) {
      conditions.push(ne(schema.reservations.id, ignoreReservationId));
    }

    const [row] = await this.db
      .select()
      .from(schema.reservations)
      .where(and(...conditions))
      .limit(1);
    return row;
  }

  async update(
    executor: DatabaseExecutor,
    businessId: string,
    id: string,
    patch: Partial<NewReservation>,
    expectedStatuses?: string[],
  ): Promise<Reservation | undefined> {
    const conditions: SQL[] = [
      eq(schema.reservations.businessId, businessId),
      eq(schema.reservations.id, id),
    ];

    if (expectedStatuses?.length) {
      conditions.push(inArray(schema.reservations.status, expectedStatuses));
    }

    const [row] = await executor
      .update(schema.reservations)
      .set(patch)
      .where(and(...conditions))
      .returning();
    return row;
  }

  private buildWhere(filters: ListReservationsFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.reservations.businessId, filters.businessId),
    ];

    if (filters.branchId) {
      conditions.push(eq(schema.reservations.branchId, filters.branchId));
    }

    if (filters.status) {
      conditions.push(eq(schema.reservations.status, filters.status));
    }

    if (filters.tableId) {
      conditions.push(eq(schema.reservations.tableId, filters.tableId));
    }

    if (filters.from) {
      conditions.push(
        gte(schema.reservations.reservedFor, new Date(filters.from)),
      );
    }

    if (filters.to) {
      conditions.push(
        lte(schema.reservations.reservedFor, new Date(filters.to)),
      );
    }

    return and(...conditions);
  }
}

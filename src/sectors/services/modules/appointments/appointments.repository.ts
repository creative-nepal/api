import { Injectable } from '@nestjs/common';
import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import type { SortDirection } from '../../../../common/dto/list-query.dto';
import {
  resolveOrderBy,
  type SortableColumns,
} from '../../../../common/repository/sorting';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../../../database';
import type {
  NewServiceAppointment,
  ServiceAppointment,
  ServiceMembership,
} from '../../../../database/schema';

const SORTABLE: SortableColumns = {
  scheduledAt: schema.serviceAppointments.scheduledAt,
  status: schema.serviceAppointments.status,
  createdAt: schema.serviceAppointments.createdAt,
};

export interface FindAppointmentsOptions {
  businessId: string;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
  status?: string;
  staffUserId?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AppointmentsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findMany(
    options: FindAppointmentsOptions,
  ): Promise<{ rows: ServiceAppointment[]; total: number }> {
    const where = and(
      eq(schema.serviceAppointments.businessId, options.businessId),
      ...(options.status
        ? [eq(schema.serviceAppointments.status, options.status)]
        : []),
      ...(options.staffUserId
        ? [eq(schema.serviceAppointments.staffUserId, options.staffUserId)]
        : []),
      ...(options.customerId
        ? [eq(schema.serviceAppointments.customerId, options.customerId)]
        : []),
      ...(options.from
        ? [gte(schema.serviceAppointments.scheduledAt, new Date(options.from))]
        : []),
      ...(options.to
        ? [lte(schema.serviceAppointments.scheduledAt, new Date(options.to))]
        : []),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.serviceAppointments)
        .where(where)
        .orderBy(
          resolveOrderBy(
            SORTABLE,
            options.sortBy,
            options.sortDirection,
            schema.serviceAppointments.scheduledAt,
          ),
        )
        .limit(options.limit)
        .offset(options.offset),
      this.db
        .select({ value: count() })
        .from(schema.serviceAppointments)
        .where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async findById(
    businessId: string,
    appointmentId: string,
  ): Promise<ServiceAppointment | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.serviceAppointments)
      .where(
        and(
          eq(schema.serviceAppointments.businessId, businessId),
          eq(schema.serviceAppointments.id, appointmentId),
        ),
      )
      .limit(1);

    return row;
  }

  async insert(values: NewServiceAppointment): Promise<ServiceAppointment> {
    const [row] = await this.db
      .insert(schema.serviceAppointments)
      .values(values)
      .returning();
    return row;
  }

  async updateStatus(
    executor: DatabaseExecutor,
    businessId: string,
    appointmentId: string,
    status: string,
    completedAt: Date | null,
  ): Promise<ServiceAppointment | undefined> {
    const [row] = await executor
      .update(schema.serviceAppointments)
      .set({ status, completedAt })
      .where(
        and(
          eq(schema.serviceAppointments.businessId, businessId),
          eq(schema.serviceAppointments.id, appointmentId),
        ),
      )
      .returning();

    return row;
  }

  async consumeSession(
    executor: DatabaseExecutor,
    businessId: string,
    membershipId: string,
  ): Promise<ServiceMembership | undefined> {
    const [row] = await executor
      .update(schema.serviceMemberships)
      .set({
        sessionsUsed: sql`${schema.serviceMemberships.sessionsUsed} + 1`,
        status: sql`case
          when ${schema.serviceMemberships.sessionsUsed} + 1 >= ${schema.serviceMemberships.sessionsTotal}
          then 'exhausted' else ${schema.serviceMemberships.status} end`,
      })
      .where(
        and(
          eq(schema.serviceMemberships.businessId, businessId),
          eq(schema.serviceMemberships.id, membershipId),
          eq(schema.serviceMemberships.status, 'active'),
          sql`${schema.serviceMemberships.sessionsUsed} < ${schema.serviceMemberships.sessionsTotal}`,
        ),
      )
      .returning();

    return row;
  }

  async countInPeriod(businessId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.serviceAppointments)
      .where(
        and(
          eq(schema.serviceAppointments.businessId, businessId),
          gte(schema.serviceAppointments.createdAt, since),
        ),
      );

    return row?.value ?? 0;
  }
}

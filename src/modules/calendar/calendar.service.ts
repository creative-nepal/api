import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  Business,
  CalendarEvent,
  CalendarScope,
  Recurrence,
} from '../../database/schema';
import type {
  CalendarFeedQueryDto,
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';
import { expandOccurrences } from './recurrence';

export interface CalendarEntry {
  id: string;
  source: 'event' | 'appointment' | 'reservation';
  scope: CalendarScope;
  kind: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  branchId: string | null;
  status: string;
  assignedToUserId: string | null;
  linkedType: string | null;
  linkedId: string | null;
}

const MAX_WINDOW_DAYS = 400;

@Injectable()
export class CalendarService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async list(
    business: Business,
    userId: string,
    query: ListCalendarEventsQueryDto,
  ): Promise<PaginatedResult<CalendarEvent>> {
    const where = and(
      eq(schema.calendarEvents.businessId, business.id),
      this.visibility(userId),
      ...(query.scope ? [eq(schema.calendarEvents.scope, query.scope)] : []),
      ...(query.status ? [eq(schema.calendarEvents.status, query.status)] : []),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.calendarEvents)
        .where(where)
        .orderBy(asc(schema.calendarEvents.startsAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.calendarEvents)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async feed(
    business: Business,
    userId: string,
    allowedBranchIds: string[] | null,
    query: CalendarFeedQueryDto,
  ): Promise<CalendarEntry[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('i18n:errors.calendar.badWindow');
    }

    if (to <= from) {
      throw new BadRequestException('i18n:errors.calendar.badWindow');
    }

    if (to.getTime() - from.getTime() > MAX_WINDOW_DAYS * 86_400_000) {
      throw new BadRequestException({
        message: 'i18n:errors.calendar.windowTooWide',
        days: MAX_WINDOW_DAYS,
      });
    }

    const entries = [
      ...(await this.eventEntries(business, userId, from, to, query)),
      ...(query.scope && query.scope !== 'branch'
        ? []
        : await this.appointmentEntries(business, from, to)),
      ...(query.scope && query.scope !== 'branch'
        ? []
        : await this.reservationEntries(business, from, to)),
    ];

    const visible = allowedBranchIds
      ? entries.filter(
          (entry) =>
            entry.branchId === null ||
            allowedBranchIds.includes(entry.branchId),
        )
      : entries;

    return visible.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }

  async create(
    business: Business,
    userId: string,
    dto: CreateCalendarEventDto,
  ): Promise<CalendarEvent> {
    if (dto.scope === 'branch' && !dto.branchId) {
      throw new BadRequestException('i18n:errors.calendar.branchRequired');
    }

    if (dto.scope !== 'branch' && dto.branchId) {
      throw new BadRequestException('i18n:errors.calendar.branchNotAllowed');
    }

    if (dto.branchId) {
      await this.requireBranch(business.id, dto.branchId);
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException('i18n:errors.calendar.endsBeforeStart');
    }

    const [row] = await this.db
      .insert(schema.calendarEvents)
      .values({
        id: randomUUID(),
        businessId: business.id,
        scope: dto.scope,
        branchId: dto.branchId ?? null,
        kind: dto.kind ?? 'event',
        title: dto.title,
        description: dto.description ?? null,
        startsAt,
        endsAt,
        allDay: dto.allDay ?? false,
        recurrence: dto.recurrence ?? null,
        remindMinutesBefore: dto.remindMinutesBefore ?? null,
        assignedToUserId:
          dto.scope === 'personal'
            ? (dto.assignedToUserId ?? userId)
            : (dto.assignedToUserId ?? null),
        linkedType: dto.linkedType ?? null,
        linkedId: dto.linkedId ?? null,
        createdByUserId: userId,
      })
      .returning();

    return row;
  }

  async update(
    business: Business,
    userId: string,
    eventId: string,
    dto: UpdateCalendarEventDto,
  ): Promise<CalendarEvent> {
    const existing = await this.getById(business.id, userId, eventId);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;

    if (endsAt && endsAt < startsAt) {
      throw new BadRequestException('i18n:errors.calendar.endsBeforeStart');
    }

    const [row] = await this.db
      .update(schema.calendarEvents)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && {
          description: dto.description,
        }),
        ...(dto.startsAt !== undefined && { startsAt }),
        ...(dto.endsAt !== undefined && { endsAt }),
        ...(dto.allDay !== undefined && { allDay: dto.allDay }),
        ...(dto.assignedToUserId !== undefined && {
          assignedToUserId: dto.assignedToUserId,
        }),
        ...(dto.remindMinutesBefore !== undefined && {
          remindMinutesBefore: dto.remindMinutesBefore,
        }),
        ...(dto.recurrence !== undefined && {
          recurrence: dto.recurrence as Recurrence | null,
        }),
        ...(dto.status !== undefined && {
          status: dto.status,
          completedAt: dto.status === 'done' ? new Date() : null,
        }),
      })
      .where(
        and(
          eq(schema.calendarEvents.businessId, business.id),
          eq(schema.calendarEvents.id, eventId),
        ),
      )
      .returning();

    return row;
  }

  async remove(
    business: Business,
    userId: string,
    eventId: string,
  ): Promise<{ id: string }> {
    await this.getById(business.id, userId, eventId);

    await this.db
      .delete(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.businessId, business.id),
          eq(schema.calendarEvents.id, eventId),
        ),
      );

    return { id: eventId };
  }

  async getById(
    businessId: string,
    userId: string,
    eventId: string,
  ): Promise<CalendarEvent> {
    const [row] = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.businessId, businessId),
          eq(schema.calendarEvents.id, eventId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.calendar.notFound',
        eventId,
      });
    }

    if (row.scope === 'personal' && row.assignedToUserId !== userId) {
      throw new ForbiddenException('i18n:errors.calendar.personal');
    }

    return row;
  }

  private visibility(userId: string): SQL | undefined {
    return or(
      inArray(schema.calendarEvents.scope, ['organisation', 'branch']),
      and(
        eq(schema.calendarEvents.scope, 'personal'),
        eq(schema.calendarEvents.assignedToUserId, userId),
      ),
    );
  }

  private async requireBranch(
    businessId: string,
    branchId: string,
  ): Promise<void> {
    const [branch] = await this.db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.branches.id, branchId),
        ),
      )
      .limit(1);

    if (!branch) {
      throw new NotFoundException({
        message: 'i18n:errors.branch.notFound',
        branchId,
      });
    }
  }

  private async eventEntries(
    business: Business,
    userId: string,
    from: Date,
    to: Date,
    query: CalendarFeedQueryDto,
  ): Promise<CalendarEntry[]> {
    const rows = await this.db
      .select()
      .from(schema.calendarEvents)
      .where(
        and(
          eq(schema.calendarEvents.businessId, business.id),
          this.visibility(userId),
          ...(query.scope
            ? [eq(schema.calendarEvents.scope, query.scope)]
            : []),
          ...(query.kind ? [eq(schema.calendarEvents.kind, query.kind)] : []),
          or(
            isNull(schema.calendarEvents.recurrence),
            lte(schema.calendarEvents.startsAt, to),
          ),
          lte(schema.calendarEvents.startsAt, to),
        ),
      );

    return rows.flatMap((row) => {
      const length =
        row.endsAt === null
          ? null
          : row.endsAt.getTime() - row.startsAt.getTime();

      return expandOccurrences(row.startsAt, row.recurrence, from, to).map(
        (startsAt) => ({
          id: row.recurrence ? `${row.id}:${startsAt.toISOString()}` : row.id,
          source: 'event' as const,
          scope: row.scope as CalendarScope,
          kind: row.kind,
          title: row.title,
          startsAt,
          endsAt:
            length === null ? null : new Date(startsAt.getTime() + length),
          allDay: row.allDay,
          branchId: row.branchId,
          status: row.status,
          assignedToUserId: row.assignedToUserId,
          linkedType: row.linkedType,
          linkedId: row.linkedId,
        }),
      );
    });
  }

  private async appointmentEntries(
    business: Business,
    from: Date,
    to: Date,
  ): Promise<CalendarEntry[]> {
    if (business.sector !== 'services') {
      return [];
    }

    const rows = await this.db
      .select({
        id: schema.serviceAppointments.id,
        scheduledAt: schema.serviceAppointments.scheduledAt,
        durationMinutes: schema.serviceAppointments.durationMinutes,
        status: schema.serviceAppointments.status,
        staffUserId: schema.serviceAppointments.staffUserId,
        serviceName: schema.serviceItems.name,
        customerName: schema.customers.name,
      })
      .from(schema.serviceAppointments)
      .innerJoin(
        schema.serviceItems,
        eq(schema.serviceItems.id, schema.serviceAppointments.serviceItemId),
      )
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.serviceAppointments.customerId),
      )
      .where(
        and(
          eq(schema.serviceAppointments.businessId, business.id),
          gte(schema.serviceAppointments.scheduledAt, from),
          lte(schema.serviceAppointments.scheduledAt, to),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      source: 'appointment' as const,
      scope: 'organisation',
      kind: 'appointment',
      title: row.customerName
        ? `${row.serviceName} — ${row.customerName}`
        : row.serviceName,
      startsAt: row.scheduledAt,
      endsAt: new Date(
        row.scheduledAt.getTime() + row.durationMinutes * 60_000,
      ),
      allDay: false,
      branchId: null,
      status: row.status,
      assignedToUserId: row.staffUserId,
      linkedType: 'appointment',
      linkedId: row.id,
    }));
  }

  private async reservationEntries(
    business: Business,
    from: Date,
    to: Date,
  ): Promise<CalendarEntry[]> {
    if (business.sector !== 'restaurant') {
      return [];
    }

    const rows = await this.db
      .select()
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.businessId, business.id),
          gte(schema.reservations.reservedFor, from),
          lte(schema.reservations.reservedFor, to),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      source: 'reservation' as const,
      scope: 'branch',
      kind: 'reservation',
      title: `${row.guestName} · ${row.partySize}`,
      startsAt: row.reservedFor,
      endsAt: new Date(
        row.reservedFor.getTime() + row.durationMinutes * 60_000,
      ),
      allDay: false,
      branchId: row.branchId,
      status: row.status,
      assignedToUserId: null,
      linkedType: 'reservation',
      linkedId: row.id,
    }));
  }
}

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { and, eq, gt, lt, ne, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type {
  StaffAvailability,
  StaffTimeOff,
} from '../../../../database/schema';

const MINUTES_IN_DAY = 24 * 60;

export interface AvailabilityWindow {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

@Injectable()
export class AvailabilityService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async listFor(
    businessId: string,
    staffUserId: string,
  ): Promise<StaffAvailability[]> {
    return this.db
      .select()
      .from(schema.staffAvailability)
      .where(
        and(
          eq(schema.staffAvailability.businessId, businessId),
          eq(schema.staffAvailability.staffUserId, staffUserId),
        ),
      );
  }

  async setFor(
    businessId: string,
    staffUserId: string,
    windows: AvailabilityWindow[],
  ): Promise<StaffAvailability[]> {
    for (const window of windows) {
      if (window.startMinute >= window.endMinute) {
        throw new BadRequestException('i18n:errors.availability.badWindow');
      }

      if (window.endMinute > MINUTES_IN_DAY) {
        throw new BadRequestException('i18n:errors.availability.pastMidnight');
      }
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.staffAvailability)
        .where(
          and(
            eq(schema.staffAvailability.businessId, businessId),
            eq(schema.staffAvailability.staffUserId, staffUserId),
          ),
        );

      if (windows.length > 0) {
        await tx.insert(schema.staffAvailability).values(
          windows.map((window) => ({
            id: randomUUID(),
            businessId,
            staffUserId,
            dayOfWeek: window.dayOfWeek,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
        );
      }
    });

    return this.listFor(businessId, staffUserId);
  }

  async addTimeOff(
    businessId: string,
    staffUserId: string,
    startsAt: Date,
    endsAt: Date,
    reason: string | null,
  ): Promise<StaffTimeOff> {
    if (startsAt >= endsAt) {
      throw new BadRequestException('i18n:errors.availability.badTimeOff');
    }

    const [row] = await this.db
      .insert(schema.staffTimeOff)
      .values({
        id: randomUUID(),
        businessId,
        staffUserId,
        startsAt,
        endsAt,
        reason,
      })
      .returning();

    return row;
  }

  async assertBookable(
    businessId: string,
    staffUserId: string,
    scheduledAt: Date,
    durationMinutes: number,
    ignoreAppointmentId?: string,
  ): Promise<void> {
    const endsAt = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

    const windows = await this.listFor(businessId, staffUserId);

    if (windows.length > 0) {
      const dayOfWeek = scheduledAt.getDay();
      const startMinute =
        scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
      const endMinute = startMinute + durationMinutes;

      const fits = windows.some(
        (window) =>
          window.dayOfWeek === dayOfWeek &&
          startMinute >= window.startMinute &&
          endMinute <= window.endMinute,
      );

      if (!fits) {
        throw new ConflictException({
          message: 'i18n:errors.availability.outsideHours',
          staffUserId,
        });
      }
    }

    const [timeOff] = await this.db
      .select()
      .from(schema.staffTimeOff)
      .where(
        and(
          eq(schema.staffTimeOff.businessId, businessId),
          eq(schema.staffTimeOff.staffUserId, staffUserId),
          lt(schema.staffTimeOff.startsAt, endsAt),
          gt(schema.staffTimeOff.endsAt, scheduledAt),
        ),
      )
      .limit(1);

    if (timeOff) {
      throw new ConflictException({
        message: 'i18n:errors.availability.onTimeOff',
        staffUserId,
      });
    }

    const [clash] = await this.db
      .select({ id: schema.serviceAppointments.id })
      .from(schema.serviceAppointments)
      .where(
        and(
          eq(schema.serviceAppointments.businessId, businessId),
          eq(schema.serviceAppointments.staffUserId, staffUserId),
          eq(schema.serviceAppointments.status, 'booked'),
          ...(ignoreAppointmentId
            ? [ne(schema.serviceAppointments.id, ignoreAppointmentId)]
            : []),
          lt(schema.serviceAppointments.scheduledAt, endsAt),
          sql`${schema.serviceAppointments.scheduledAt}
              + make_interval(mins => ${schema.serviceAppointments.durationMinutes})
              > ${scheduledAt.toISOString()}::timestamptz`,
        ),
      )
      .limit(1);

    if (clash) {
      throw new ConflictException({
        message: 'i18n:errors.availability.doubleBooked',
        staffUserId,
      });
    }
  }
}

import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import {
  NotificationsService,
  type RaiseNotification,
} from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

@Injectable()
export class CalendarRemindersJob {
  static readonly NAME = 'calendar-reminders';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const now = new Date();

    const due = await this.db
      .update(schema.calendarEvents)
      .set({ reminderSentAt: now })
      .where(
        and(
          eq(schema.calendarEvents.status, 'open'),
          isNotNull(schema.calendarEvents.remindMinutesBefore),
          isNull(schema.calendarEvents.reminderSentAt),
          gt(schema.calendarEvents.startsAt, now),
          sql`${schema.calendarEvents.startsAt} - make_interval(mins => ${schema.calendarEvents.remindMinutesBefore}) <= now()`,
        ),
      )
      .returning({
        id: schema.calendarEvents.id,
        businessId: schema.calendarEvents.businessId,
        title: schema.calendarEvents.title,
        startsAt: schema.calendarEvents.startsAt,
        assignedToUserId: schema.calendarEvents.assignedToUserId,
      });

    if (due.length === 0) {
      return { due: 0, raised: 0 };
    }

    const raises: RaiseNotification[] = due.map((event) => ({
      businessId: event.businessId,
      type: 'calendar.reminder',
      severity: 'info' as const,
      titleKey: 'ui.web.notifications.calendarReminderTitle',
      bodyKey: 'ui.web.notifications.calendarReminderBody',
      params: {
        title: event.title,
        at: event.startsAt.toISOString().slice(0, 16).replace('T', ' '),
      },
      href: '/calendar',
      dedupeKey: `calendar.reminder:${event.id}`,
      ...(event.assignedToUserId ? { userId: event.assignedToUserId } : {}),
    }));

    return {
      due: due.length,
      raised: await this.notifications.raiseMany(raises),
    };
  }
}

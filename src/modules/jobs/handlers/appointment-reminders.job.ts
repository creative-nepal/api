import { Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import { EmailService } from '../../../email/email.service';
import {
  NotificationsService,
  type RaiseNotification,
} from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

const LEAD_HOURS = 24;

@Injectable()
export class AppointmentRemindersJob {
  static readonly NAME = 'appointment-reminders';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const now = new Date();

    const claimed = await this.db
      .update(schema.serviceAppointments)
      .set({ reminderSentAt: now })
      .where(
        and(
          eq(schema.serviceAppointments.status, 'booked'),
          isNull(schema.serviceAppointments.reminderSentAt),
          gt(schema.serviceAppointments.scheduledAt, now),
          lte(
            schema.serviceAppointments.scheduledAt,
            new Date(now.getTime() + LEAD_HOURS * 3_600_000),
          ),
        ),
      )
      .returning({ id: schema.serviceAppointments.id });

    if (claimed.length === 0) {
      return { due: 0, emailed: 0, raised: 0 };
    }

    const due = await this.db
      .select({
        appointmentId: schema.serviceAppointments.id,
        businessId: schema.serviceAppointments.businessId,
        scheduledAt: schema.serviceAppointments.scheduledAt,
        durationMinutes: schema.serviceAppointments.durationMinutes,
        serviceName: schema.serviceItems.name,
        customerName: schema.customers.name,
        customerEmail: schema.customers.email,
        staffName: schema.user.name,
        businessName: schema.businesses.legalName,
      })
      .from(schema.serviceAppointments)
      .innerJoin(
        schema.serviceItems,
        eq(schema.serviceItems.id, schema.serviceAppointments.serviceItemId),
      )
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.serviceAppointments.businessId),
      )
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.serviceAppointments.customerId),
      )
      .leftJoin(
        schema.user,
        eq(schema.user.id, schema.serviceAppointments.staffUserId),
      )
      .where(
        and(
          eq(schema.businesses.status, 'active'),
          inArray(
            schema.serviceAppointments.id,
            claimed.map((row) => row.id),
          ),
        ),
      );

    let emailed = 0;
    const raises: RaiseNotification[] = [];

    for (const row of due) {
      const scheduledAtLabel = row.scheduledAt
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ');

      if (row.customerEmail && row.customerName) {
        await this.email.sendAppointmentReminderEmail(row.customerEmail, {
          businessName: row.businessName,
          customerName: row.customerName,
          serviceName: row.serviceName,
          scheduledAtLabel,
          durationMinutes: row.durationMinutes,
          ...(row.staffName ? { staffName: row.staffName } : {}),
        });
        emailed += 1;
      }

      raises.push({
        businessId: row.businessId,
        type: 'appointment.upcoming',
        severity: 'info',
        titleKey: 'ui.web.notifications.appointmentReminderTitle',
        bodyKey: 'ui.web.notifications.appointmentReminderBody',
        params: {
          service: row.serviceName,
          customer: row.customerName ?? '—',
          at: scheduledAtLabel,
        },
        href: '/appointments',
        dedupeKey: `appointment.upcoming:${row.appointmentId}`,
      });
    }

    const raised = await this.notifications.raiseMany(raises);

    return { due: claimed.length, notified: due.length, emailed, raised };
  }
}

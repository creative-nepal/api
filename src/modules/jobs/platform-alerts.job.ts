import { Injectable } from '@nestjs/common';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import {
  NotificationsService,
  type RaiseNotification,
} from '../notifications/notifications.service';
import type { JobDetail } from './job-runner.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PlatformAlertsJob {
  static readonly NAME = 'platform-alerts';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const since = new Date(Date.now() - DAY_MS);
    const day = since.toISOString().slice(0, 10);

    const [deadEmails] = await this.db
      .select({ value: count() })
      .from(schema.emailOutbox)
      .where(eq(schema.emailOutbox.status, 'failed'));

    const [cbmsFailures] = await this.db
      .select({ value: count() })
      .from(schema.cbmsPushQueue)
      .where(eq(schema.cbmsPushQueue.status, 'failed'));

    const [failedJobs] = await this.db
      .select({ value: count() })
      .from(schema.jobRuns)
      .where(
        and(
          eq(schema.jobRuns.status, 'failed'),
          gte(schema.jobRuns.startedAt, since),
          sql`${schema.jobRuns.name} <> 'platform-alerts'`,
        ),
      );

    const raises: RaiseNotification[] = [];

    if ((deadEmails?.value ?? 0) > 0) {
      raises.push({
        businessId: null,
        type: 'platform.emailDeadLetter',
        severity: 'critical',
        titleKey: 'ui.admin.notifications.emailFailedTitle',
        bodyKey: 'ui.admin.notifications.emailFailedBody',
        params: { count: deadEmails.value },
        dedupeKey: `platform.emailDeadLetter:${day}`,
      });
    }

    if ((cbmsFailures?.value ?? 0) > 0) {
      raises.push({
        businessId: null,
        type: 'platform.cbmsFailed',
        severity: 'critical',
        titleKey: 'ui.admin.notifications.cbmsFailedTitle',
        bodyKey: 'ui.admin.notifications.cbmsFailedBody',
        params: { count: cbmsFailures.value },
        dedupeKey: `platform.cbmsFailed:${day}`,
      });
    }

    if ((failedJobs?.value ?? 0) > 0) {
      raises.push({
        businessId: null,
        type: 'platform.jobFailed',
        severity: 'warning',
        titleKey: 'ui.admin.notifications.jobFailedTitle',
        bodyKey: 'ui.admin.notifications.jobFailedBody',
        params: { count: failedJobs.value },
        dedupeKey: `platform.jobFailed:${day}`,
      });
    }

    const raised = await this.notifications.raiseMany(raises);

    return {
      deadEmails: deadEmails?.value ?? 0,
      cbmsFailures: cbmsFailures?.value ?? 0,
      failedJobs: failedJobs?.value ?? 0,
      raised,
    };
  }
}

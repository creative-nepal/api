import { Injectable } from '@nestjs/common';
import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import {
  NotificationsService,
  type RaiseNotification,
} from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

const TRIAL_WARNING_DAYS = 3;

@Injectable()
export class SubscriptionLifecycleJob {
  static readonly NAME = 'subscription-lifecycle';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const now = new Date();

    const lapsed = await this.db
      .update(schema.subscriptions)
      .set({ status: 'past_due' })
      .where(
        and(
          sql`${schema.subscriptions.status} in ('trialing', 'active')`,
          lte(schema.subscriptions.currentPeriodEnd, now),
        ),
      )
      .returning({
        id: schema.subscriptions.id,
        businessId: schema.subscriptions.businessId,
      });

    const endingSoon = await this.db
      .select({
        businessId: schema.subscriptions.businessId,
        id: schema.subscriptions.id,
        endsAt: schema.subscriptions.currentPeriodEnd,
      })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.status, 'trialing'),
          gt(schema.subscriptions.currentPeriodEnd, now),
          sql`${schema.subscriptions.currentPeriodEnd} <= now() + make_interval(days => ${TRIAL_WARNING_DAYS})`,
        ),
      );

    const raises: RaiseNotification[] = [
      ...lapsed.map((row) => ({
        businessId: row.businessId,
        type: 'subscription.pastDue',
        severity: 'critical' as const,
        titleKey: 'ui.web.notifications.pastDueTitle',
        bodyKey: 'ui.web.notifications.pastDueBody',
        href: '/settings',
        dedupeKey: `subscription.pastDue:${row.id}`,
      })),
      ...endingSoon.map((row) => ({
        businessId: row.businessId,
        type: 'subscription.trialEnding',
        severity: 'warning' as const,
        titleKey: 'ui.web.notifications.trialEndingTitle',
        bodyKey: 'ui.web.notifications.trialEndingBody',
        params: { date: row.endsAt.toISOString().slice(0, 10) },
        href: '/settings',
        dedupeKey: `subscription.trialEnding:${row.id}`,
      })),
    ];

    const raised = await this.notifications.raiseMany(raises);

    return {
      movedToPastDue: lapsed.length,
      trialEndingSoon: endingSoon.length,
      raised,
    };
  }
}

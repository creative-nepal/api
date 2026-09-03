import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import { EmailService } from '../../../email/email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

const DIGEST_ROLES = ['owner', 'manager'];

@Injectable()
export class NotificationDigestJob {
  static readonly NAME = 'notification-digest';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService,
  ) {}

  async run(): Promise<JobDetail> {
    const workspaceUrl =
      process.env.INVITATION_ACCEPT_URL?.replace(/\/accept-invitation$/, '') ??
      'http://localhost:3000';

    const recipients = await this.db
      .select({
        businessId: schema.businesses.id,
        businessName: schema.businesses.legalName,
        userId: schema.member.userId,
        email: schema.user.email,
      })
      .from(schema.member)
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.organizationId, schema.member.organizationId),
      )
      .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
      .where(
        and(
          eq(schema.businesses.status, 'active'),
          inArray(schema.member.role, DIGEST_ROLES),
        ),
      );

    let queued = 0;

    for (const recipient of recipients) {
      const unread = await this.notifications.unreadForDigest(
        recipient.businessId,
        recipient.userId,
      );

      if (unread.length === 0) {
        continue;
      }

      await this.email.sendNotificationDigestEmail(recipient.email, {
        businessName: recipient.businessName,
        workspaceUrl,
        items: unread.map((row) => ({
          title: row.notification.titleKey,
          body: row.notification.bodyKey ?? undefined,
          severity: row.notification.severity,
        })),
      });

      queued += 1;
    }

    return { recipients: recipients.length, queued };
  }
}

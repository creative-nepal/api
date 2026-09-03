import { Injectable } from '@nestjs/common';
import { EmailOutboxJob } from './handlers/email-outbox.job';
import { ExpiryWriteOffJob } from './handlers/expiry-write-off.job';
import { FileCleanupJob } from './handlers/file-cleanup.job';
import { InvoiceLeaseExpiryJob } from './handlers/invoice-lease-expiry.job';
import type { JobDetail } from './job-runner.service';
import { NotificationDigestJob } from './handlers/notification-digest.job';
import { PlatformAlertsJob } from './handlers/platform-alerts.job';
import { StockAlertsJob } from './handlers/stock-alerts.job';
import { SubscriptionLifecycleJob } from './handlers/subscription-lifecycle.job';

export interface JobDescriptor {
  name: string;
  defaultCron: string;
  run: () => Promise<JobDetail>;
}

@Injectable()
export class JobsRegistry {
  private readonly jobs: Map<string, JobDescriptor>;

  constructor(
    emailOutbox: EmailOutboxJob,
    leaseExpiry: InvoiceLeaseExpiryJob,
    stockAlerts: StockAlertsJob,
    subscriptions: SubscriptionLifecycleJob,
    digest: NotificationDigestJob,
    platformAlerts: PlatformAlertsJob,
    fileCleanup: FileCleanupJob,
    expiryWriteOff: ExpiryWriteOffJob,
  ) {
    const descriptors: JobDescriptor[] = [
      {
        name: EmailOutboxJob.NAME,
        defaultCron: '0 * * * * *',
        run: () => emailOutbox.run(),
      },
      {
        name: InvoiceLeaseExpiryJob.NAME,
        defaultCron: '0 */10 * * * *',
        run: () => leaseExpiry.run(),
      },
      {
        name: StockAlertsJob.NAME,
        defaultCron: '0 0 6 * * *',
        run: () => stockAlerts.run(),
      },
      {
        name: SubscriptionLifecycleJob.NAME,
        defaultCron: '0 0 1 * * *',
        run: () => subscriptions.run(),
      },
      {
        name: NotificationDigestJob.NAME,
        defaultCron: '0 0 7 * * *',
        run: () => digest.run(),
      },
      {
        name: PlatformAlertsJob.NAME,
        defaultCron: '0 */30 * * * *',
        run: () => platformAlerts.run(),
      },
      {
        name: ExpiryWriteOffJob.NAME,
        defaultCron: '0 15 3 * * *',
        run: () => expiryWriteOff.run(),
      },
      {
        name: FileCleanupJob.NAME,
        defaultCron: '0 30 3 * * *',
        run: () => fileCleanup.run(),
      },
    ];

    this.jobs = new Map(descriptors.map((job) => [job.name, job]));
  }

  list(): JobDescriptor[] {
    return [...this.jobs.values()];
  }

  get(name: string): JobDescriptor | undefined {
    return this.jobs.get(name);
  }
}

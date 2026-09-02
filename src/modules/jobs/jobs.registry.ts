import { Injectable } from '@nestjs/common';
import { EmailOutboxJob } from './email-outbox.job';
import { FileCleanupJob } from './file-cleanup.job';
import { InvoiceLeaseExpiryJob } from './invoice-lease-expiry.job';
import type { JobDetail } from './job-runner.service';
import { NotificationDigestJob } from './notification-digest.job';
import { PlatformAlertsJob } from './platform-alerts.job';
import { StockAlertsJob } from './stock-alerts.job';
import { SubscriptionLifecycleJob } from './subscription-lifecycle.job';

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

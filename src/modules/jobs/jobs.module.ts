import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../../email';
import { FilesCoreModule } from '../files/files-core.module';
import { NotificationsCoreModule } from '../notifications/notifications-core.module';
import { SyncModule } from '../sync/sync.module';
import { EmailOutboxJob } from './handlers/email-outbox.job';
import { FileCleanupJob } from './handlers/file-cleanup.job';
import { InvoiceLeaseExpiryJob } from './handlers/invoice-lease-expiry.job';
import { JobRunnerService } from './job-runner.service';
import { JobsController } from './jobs.controller';
import { JobsRegistry } from './jobs.registry';
import { JobSchedulesService } from './job-schedules.service';
import { JobsBootstrap } from './jobs.bootstrap';
import { NotificationDigestJob } from './handlers/notification-digest.job';
import { PlatformAlertsJob } from './handlers/platform-alerts.job';
import { StockAlertsJob } from './handlers/stock-alerts.job';
import { SubscriptionLifecycleJob } from './handlers/subscription-lifecycle.job';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EmailModule,
    NotificationsCoreModule,
    FilesCoreModule,
    SyncModule,
  ],
  controllers: [JobsController],
  providers: [
    JobRunnerService,
    JobsRegistry,
    JobSchedulesService,
    JobsBootstrap,
    EmailOutboxJob,
    FileCleanupJob,
    InvoiceLeaseExpiryJob,
    StockAlertsJob,
    SubscriptionLifecycleJob,
    NotificationDigestJob,
    PlatformAlertsJob,
  ],
  exports: [JobRunnerService],
})
export class JobsModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from '../../email';
import { NotificationsCoreModule } from '../notifications/notifications-core.module';
import { SyncModule } from '../sync/sync.module';
import { EmailOutboxJob } from './email-outbox.job';
import { InvoiceLeaseExpiryJob } from './invoice-lease-expiry.job';
import { JobRunnerService } from './job-runner.service';
import { JobsController } from './jobs.controller';
import { JobsRegistry } from './jobs.registry';
import { JobSchedulesService } from './job-schedules.service';
import { JobsBootstrap } from './jobs.bootstrap';
import { NotificationDigestJob } from './notification-digest.job';
import { PlatformAlertsJob } from './platform-alerts.job';
import { StockAlertsJob } from './stock-alerts.job';
import { SubscriptionLifecycleJob } from './subscription-lifecycle.job';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    EmailModule,
    NotificationsCoreModule,
    SyncModule,
  ],
  controllers: [JobsController],
  providers: [
    JobRunnerService,
    JobsRegistry,
    JobSchedulesService,
    JobsBootstrap,
    EmailOutboxJob,
    InvoiceLeaseExpiryJob,
    StockAlertsJob,
    SubscriptionLifecycleJob,
    NotificationDigestJob,
    PlatformAlertsJob,
  ],
  exports: [JobRunnerService],
})
export class JobsModule {}

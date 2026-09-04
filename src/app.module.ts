import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth';
import { ConfigModule } from './config';
import { DatabaseModule } from './database';
import { EmailModule } from './email';
import { StorageModule } from './storage';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingModule } from './common/logging/logging.module';
import { HealthModule } from './health';
import { I18nModule } from './i18n/i18n.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ContentModule } from './modules/content/content.module';
import { CashModule } from './modules/cash/cash.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { CustomersModule } from './modules/customers/customers.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { FilesModule } from './modules/files/files.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlatformBillingModule } from './modules/platform-billing/platform-billing.module';
import { PlatformModule } from './modules/platform/platform.module';
import { RolesModule } from './modules/roles/roles.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SyncModule } from './modules/sync/sync.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { enabledSectorModules } from './sectors';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ConfigModule,
    LoggingModule,
    I18nModule,
    DatabaseModule,
    EmailModule,
    StorageModule,
    AuthModule,
    HealthModule,
    UsersModule,
    EntitlementsModule,
    BusinessesModule,
    BranchesModule,
    PlansModule,
    ContentModule,
    CashModule,
    ExpensesModule,
    LoyaltyModule,
    CustomersModule,
    PlatformModule,
    PlatformBillingModule,
    SubscriptionsModule,
    RolesModule,
    SyncModule,
    InvoicesModule,
    OrdersModule,
    WorkspaceModule,
    NotificationsModule,
    FilesModule,
    JobsModule,
    ...enabledSectorModules(),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    HttpExceptionFilter,
  ],
})
export class AppModule {}

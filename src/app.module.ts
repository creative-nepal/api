import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth';
import { ConfigModule } from './config';
import { DatabaseModule } from './database';
import { EmailModule } from './email';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingModule } from './common/logging/logging.module';
import { HealthModule } from './health';
import { I18nModule } from './i18n/i18n.module';
import { BatchesModule } from './modules/batches/batches.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { ContentModule } from './modules/content/content.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { MenuModule } from './modules/menu/menu.module';
import { MedicalModule } from './modules/medical/medical.module';
import { RestaurantAnalyticsModule } from './modules/restaurant-analytics/restaurant-analytics.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { SyncModule } from './modules/sync/sync.module';
import { TableBillingModule } from './modules/table-billing/table-billing.module';
import { TableSessionsModule } from './modules/table-sessions/table-sessions.module';
import { TablesModule } from './modules/tables/tables.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlansModule } from './modules/plans/plans.module';
import { PlatformBillingModule } from './modules/platform-billing/platform-billing.module';
import { PlatformModule } from './modules/platform/platform.module';
import { ProductsModule } from './modules/products/products.module';
import { StockAdjustmentsModule } from './modules/stock-adjustments/stock-adjustments.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    ConfigModule,
    LoggingModule,
    I18nModule,
    DatabaseModule,
    EmailModule,
    AuthModule,
    HealthModule,
    UsersModule,
    EntitlementsModule,
    BusinessesModule,
    PlansModule,
    ContentModule,
    PlatformModule,
    PlatformBillingModule,
    SubscriptionsModule,
    ProductsModule,
    BatchesModule,
    StockAdjustmentsModule,
    MedicalModule,
    TablesModule,
    MenuModule,
    TableSessionsModule,
    KitchenModule,
    TableBillingModule,
    RestaurantAnalyticsModule,
    SyncModule,
    PurchasingModule,
    InvoicesModule,
    OrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    HttpExceptionFilter,
  ],
})
export class AppModule {}

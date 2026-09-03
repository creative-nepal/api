import type { Type } from '@nestjs/common';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { MenuModule } from './modules/menu/menu.module';
import { ProductsModule } from '../../modules/products/products.module';
import { PurchasingModule } from '../../modules/purchasing/purchasing.module';
import { RestaurantAnalyticsModule } from './modules/analytics/restaurant-analytics.module';
import { StockAdjustmentsModule } from '../../modules/stock-adjustments/stock-adjustments.module';
import { TableBillingModule } from './modules/table-billing/table-billing.module';
import { TableSessionsModule } from './modules/table-sessions/table-sessions.module';
import { TablesModule } from './modules/tables/tables.module';

export const restaurantModules: Type<unknown>[] = [
  ProductsModule,
  StockAdjustmentsModule,
  PurchasingModule,
  TablesModule,
  MenuModule,
  TableSessionsModule,
  KitchenModule,
  TableBillingModule,
  RestaurantAnalyticsModule,
];

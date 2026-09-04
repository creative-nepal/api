import type { Type } from '@nestjs/common';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { MenuModule } from './modules/menu/menu.module';
import { ProductsModule } from '../../modules/products/products.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PurchasingModule } from '../../modules/purchasing/purchasing.module';
import { RestaurantAnalyticsModule } from './modules/analytics/restaurant-analytics.module';
import { StockAdjustmentsModule } from '../../modules/stock-adjustments/stock-adjustments.module';
import { StockTakesModule } from '../../modules/stock-takes/stock-takes.module';
import { WastageModule } from '../../modules/wastage/wastage.module';
import { TableAreasModule } from './modules/table-areas/table-areas.module';
import { TableBillingModule } from './modules/table-billing/table-billing.module';
import { TableMovesModule } from './modules/table-moves/table-moves.module';
import { TableSessionsModule } from './modules/table-sessions/table-sessions.module';
import { TablesModule } from './modules/tables/tables.module';

export const restaurantModules: Type<unknown>[] = [
  ProductsModule,
  StockAdjustmentsModule,
  StockTakesModule,
  WastageModule,
  PurchasingModule,
  TablesModule,
  TableAreasModule,
  ReservationsModule,
  ChannelsModule,
  MenuModule,
  TableSessionsModule,
  KitchenModule,
  TableBillingModule,
  TableMovesModule,
  RestaurantAnalyticsModule,
];

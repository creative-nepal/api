import type { Type } from '@nestjs/common';
import { ProductsModule } from '../../modules/products/products.module';
import { PurchasingModule } from '../../modules/purchasing/purchasing.module';
import { StockAdjustmentsModule } from '../../modules/stock-adjustments/stock-adjustments.module';
import { WastageModule } from '../../modules/wastage/wastage.module';
import { FrontDeskModule } from './modules/front-desk/front-desk.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { RoomsModule } from './modules/rooms/rooms.module';

export const hotelModules: Type<unknown>[] = [
  ProductsModule,
  StockAdjustmentsModule,
  WastageModule,
  PurchasingModule,
  RoomsModule,
  FrontDeskModule,
  HousekeepingModule,
];

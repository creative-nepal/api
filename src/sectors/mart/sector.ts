import type { Type } from '@nestjs/common';
import { ProductsModule } from '../../modules/products/products.module';
import { PurchasingModule } from '../../modules/purchasing/purchasing.module';
import { StockAdjustmentsModule } from '../../modules/stock-adjustments/stock-adjustments.module';
import { StockTakesModule } from '../../modules/stock-takes/stock-takes.module';

export const martModules: Type<unknown>[] = [
  ProductsModule,
  StockAdjustmentsModule,
  StockTakesModule,
  PurchasingModule,
];

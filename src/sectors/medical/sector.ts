import type { Type } from '@nestjs/common';
import { BatchesModule } from '../../modules/batches/batches.module';
import { MedicalModule } from '../../modules/medical/medical.module';
import { ProductsModule } from '../../modules/products/products.module';
import { PurchasingModule } from '../../modules/purchasing/purchasing.module';
import { StockAdjustmentsModule } from '../../modules/stock-adjustments/stock-adjustments.module';

export const medicalModules: Type<unknown>[] = [
  ProductsModule,
  StockAdjustmentsModule,
  PurchasingModule,
  BatchesModule,
  MedicalModule,
];

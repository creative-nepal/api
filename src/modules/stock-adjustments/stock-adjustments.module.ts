import { Module } from '@nestjs/common';
import { BatchesCoreModule } from '../batches/batches-core.module';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { ProductsCoreModule } from '../products/products-core.module';
import {
  ProductStockController,
  StockAdjustmentsController,
} from './stock-adjustments.controller';
import { StockAdjustmentsRepository } from './stock-adjustments.repository';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [ProductsCoreModule, BatchesCoreModule, BranchesCoreModule],
  controllers: [StockAdjustmentsController, ProductStockController],
  providers: [StockAdjustmentsService, StockAdjustmentsRepository],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}

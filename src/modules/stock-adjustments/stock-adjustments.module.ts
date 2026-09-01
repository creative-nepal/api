import { Module } from '@nestjs/common';
import { BatchesModule } from '../batches/batches.module';
import { ProductsModule } from '../products/products.module';
import {
  ProductStockController,
  StockAdjustmentsController,
} from './stock-adjustments.controller';
import { StockAdjustmentsRepository } from './stock-adjustments.repository';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Module({
  imports: [ProductsModule, BatchesModule],
  controllers: [StockAdjustmentsController, ProductStockController],
  providers: [StockAdjustmentsService, StockAdjustmentsRepository],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}

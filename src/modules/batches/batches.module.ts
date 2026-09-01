import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import {
  BatchesController,
  ProductBatchesController,
} from './batches.controller';
import { BatchesRepository } from './batches.repository';
import { BatchesService } from './batches.service';

@Module({
  imports: [ProductsModule],
  controllers: [BatchesController, ProductBatchesController],
  providers: [BatchesService, BatchesRepository],
  exports: [BatchesService, BatchesRepository],
})
export class BatchesModule {}

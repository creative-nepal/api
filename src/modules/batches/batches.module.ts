import { Module } from '@nestjs/common';
import { BatchesCoreModule } from './batches-core.module';
import {
  BatchesController,
  ProductBatchesController,
} from './batches.controller';

@Module({
  imports: [BatchesCoreModule],
  controllers: [BatchesController, ProductBatchesController],
  exports: [BatchesCoreModule],
})
export class BatchesModule {}

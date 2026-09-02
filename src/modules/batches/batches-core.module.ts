import { Module } from '@nestjs/common';
import { ProductsCoreModule } from '../products/products-core.module';
import { BatchesRepository } from './batches.repository';
import { BatchesService } from './batches.service';

@Module({
  imports: [ProductsCoreModule],
  providers: [BatchesService, BatchesRepository],
  exports: [BatchesService, BatchesRepository],
})
export class BatchesCoreModule {}

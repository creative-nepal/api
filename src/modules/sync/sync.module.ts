import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { InvoiceLeasesService } from './invoice-leases.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [SyncController],
  providers: [InvoiceLeasesService, SyncService],
  exports: [InvoiceLeasesService, SyncService],
})
export class SyncModule {}

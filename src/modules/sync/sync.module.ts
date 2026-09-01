import { Module } from '@nestjs/common';
import { InvoiceLeasesService } from './invoice-leases.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  controllers: [SyncController],
  providers: [InvoiceLeasesService, SyncService],
  exports: [InvoiceLeasesService, SyncService],
})
export class SyncModule {}

import { Module } from '@nestjs/common';
import { InvoicesExportService } from './invoices-export.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';
import { RegistersService } from './registers.service';

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesRepository,
    RegistersService,
    InvoicesExportService,
  ],
  exports: [InvoicesService, InvoicesRepository],
})
export class InvoicesModule {}

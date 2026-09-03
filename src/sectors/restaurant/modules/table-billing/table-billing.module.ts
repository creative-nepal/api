import { Module } from '@nestjs/common';
import { InvoicesModule } from '../../../../modules/invoices/invoices.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { TablesModule } from '../tables/tables.module';
import { TableBillingController } from './table-billing.controller';
import { TableBillingService } from './table-billing.service';

@Module({
  imports: [TablesModule, InvoicesModule, TableSessionsModule],
  controllers: [TableBillingController],
  providers: [TableBillingService],
  exports: [TableBillingService],
})
export class TableBillingModule {}

import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { CashCoreModule } from './cash-core.module';
import {
  CashSessionsController,
  InvoicePaymentsController,
} from './cash.controller';

@Module({
  imports: [CashCoreModule, BranchesCoreModule],
  controllers: [CashSessionsController, InvoicePaymentsController],
})
export class CashModule {}

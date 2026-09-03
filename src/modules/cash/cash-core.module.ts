import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module';
import { CashRepository } from './cash.repository';
import { CashService } from './cash.service';

@Module({
  imports: [InvoicesModule],
  providers: [CashService, CashRepository],
  exports: [CashService, CashRepository],
})
export class CashCoreModule {}

import { Module } from '@nestjs/common';
import { BatchesCoreModule } from '../batches/batches-core.module';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { DebitNotesService } from './debit-notes.service';
import { PurchaseRegisterService } from './purchase-register.service';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { TdsReportService } from './tds-report.service';

@Module({
  imports: [BatchesCoreModule, BranchesCoreModule],
  controllers: [PurchasingController],
  providers: [
    PurchasingService,
    DebitNotesService,
    PurchaseRegisterService,
    TdsReportService,
  ],
  exports: [PurchasingService, DebitNotesService],
})
export class PurchasingModule {}

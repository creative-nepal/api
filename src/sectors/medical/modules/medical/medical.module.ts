import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { StockAdjustmentsModule } from '../../../../modules/stock-adjustments/stock-adjustments.module';
import { BatchReportService } from './batch-report.service';
import { MedicalController } from './medical.controller';
import { ClaimsService } from './claims.service';
import { MedicalService } from './medical.service';
import { RecallService } from './recall.service';
import { SubstitutesService } from './substitutes.service';

@Module({
  imports: [StockAdjustmentsModule, BranchesCoreModule],
  controllers: [MedicalController],
  providers: [
    MedicalService,
    BatchReportService,
    ClaimsService,
    SubstitutesService,
    RecallService,
  ],
  exports: [MedicalService, BatchReportService],
})
export class MedicalModule {}

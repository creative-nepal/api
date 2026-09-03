import { Module } from '@nestjs/common';
import { BatchReportService } from './batch-report.service';
import { MedicalController } from './medical.controller';
import { ClaimsService } from './claims.service';
import { MedicalService } from './medical.service';

@Module({
  controllers: [MedicalController],
  providers: [MedicalService, BatchReportService, ClaimsService],
  exports: [MedicalService, BatchReportService],
})
export class MedicalModule {}

import { Module } from '@nestjs/common';
import { BatchReportService } from './batch-report.service';
import { MedicalController } from './medical.controller';
import { MedicalService } from './medical.service';

@Module({
  controllers: [MedicalController],
  providers: [MedicalService, BatchReportService],
  exports: [MedicalService, BatchReportService],
})
export class MedicalModule {}

import { Module } from '@nestjs/common';
import { BatchesModule } from '../batches/batches.module';
import { PurchaseRegisterService } from './purchase-register.service';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';
import { TdsReportService } from './tds-report.service';

@Module({
  imports: [BatchesModule],
  controllers: [PurchasingController],
  providers: [PurchasingService, PurchaseRegisterService, TdsReportService],
  exports: [PurchasingService],
})
export class PurchasingModule {}

import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { LedgersService } from './ledgers.service';
import { ProfitService } from './profit.service';
import { ReportsController } from './reports.controller';
import { ReportsExportService } from './reports-export.service';
import { StockMovementService } from './stock-movement.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [ReportsController],
  providers: [
    ProfitService,
    LedgersService,
    StockMovementService,
    ReportsExportService,
  ],
  exports: [ProfitService, LedgersService, StockMovementService],
})
export class ReportsModule {}

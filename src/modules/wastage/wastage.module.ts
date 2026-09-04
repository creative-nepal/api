import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { StockAdjustmentsModule } from '../stock-adjustments/stock-adjustments.module';
import { WastageController } from './wastage.controller';
import { WastageService } from './wastage.service';

@Module({
  imports: [StockAdjustmentsModule, BranchesCoreModule],
  controllers: [WastageController],
  providers: [WastageService],
  exports: [WastageService],
})
export class WastageModule {}

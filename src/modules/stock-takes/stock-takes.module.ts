import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { StockAdjustmentsModule } from '../stock-adjustments/stock-adjustments.module';
import { StockTakesController } from './stock-takes.controller';
import { StockTakesRepository } from './stock-takes.repository';
import { StockTakesService } from './stock-takes.service';

@Module({
  imports: [StockAdjustmentsModule, BranchesCoreModule],
  controllers: [StockTakesController],
  providers: [StockTakesService, StockTakesRepository],
  exports: [StockTakesService],
})
export class StockTakesModule {}

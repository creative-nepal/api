import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { LiveSalesController } from './live-sales.controller';
import { LiveSalesService } from './live-sales.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [LiveSalesController],
  providers: [LiveSalesService],
  exports: [LiveSalesService],
})
export class LiveSalesModule {}

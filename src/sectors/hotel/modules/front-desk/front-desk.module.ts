import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { InvoicesModule } from '../../../../modules/invoices/invoices.module';
import { RoomsModule } from '../rooms/rooms.module';
import { FrontDeskController } from './front-desk.controller';
import { FrontDeskService } from './front-desk.service';

@Module({
  imports: [RoomsModule, InvoicesModule, BranchesCoreModule],
  controllers: [FrontDeskController],
  providers: [FrontDeskService],
  exports: [FrontDeskService],
})
export class FrontDeskModule {}

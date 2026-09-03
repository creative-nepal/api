import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { TablesModule } from '../tables/tables.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [TablesModule, BranchesCoreModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsRepository],
  exports: [ReservationsService],
})
export class ReservationsModule {}

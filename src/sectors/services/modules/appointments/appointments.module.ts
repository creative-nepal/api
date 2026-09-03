import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../../../../modules/entitlements/entitlements.module';
import { ServicesCoreModule } from '../services/services-core.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsRepository } from './appointments.repository';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [ServicesCoreModule, EntitlementsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentsRepository],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

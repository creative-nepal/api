import type { Type } from '@nestjs/common';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ServicesModule } from './modules/services/services.module';

export const servicesModules: Type<unknown>[] = [
  ServicesModule,
  AppointmentsModule,
];

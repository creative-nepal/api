import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansPublicController } from './plans-public.controller';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansController, PlansPublicController],
  providers: [PlansService, PlansRepository],
  exports: [PlansService, PlansRepository],
})
export class PlansModule {}

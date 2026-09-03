import { Module } from '@nestjs/common';
import { PlansAdminController } from './plans-admin.controller';
import { PlansPublicController } from './plans-public.controller';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

@Module({
  controllers: [PlansAdminController, PlansPublicController],
  providers: [PlansService, PlansRepository],
  exports: [PlansService, PlansRepository],
})
export class PlansModule {}

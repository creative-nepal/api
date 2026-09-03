import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsAdminController } from './subscriptions-admin.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [BusinessesModule, PlansModule],
  controllers: [SubscriptionsController, SubscriptionsAdminController],
  providers: [SubscriptionsService, SubscriptionsRepository],
  exports: [SubscriptionsService, SubscriptionsRepository],
})
export class SubscriptionsModule {}

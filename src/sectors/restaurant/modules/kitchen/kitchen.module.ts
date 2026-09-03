import { Module } from '@nestjs/common';
import { NotificationsCoreModule } from '../../../../modules/notifications/notifications-core.module';
import { MenuModule } from '../menu/menu.module';
import {
  KitchenController,
  OrderLifecycleController,
} from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  imports: [MenuModule, NotificationsCoreModule],
  controllers: [KitchenController, OrderLifecycleController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}

import { Module } from '@nestjs/common';
import {
  KitchenController,
  OrderLifecycleController,
} from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  controllers: [KitchenController, OrderLifecycleController],
  providers: [KitchenService],
  exports: [KitchenService],
})
export class KitchenModule {}

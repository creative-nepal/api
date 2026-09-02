import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { MenuModule } from '../menu/menu.module';
import { OrdersModule } from '../orders/orders.module';
import { PublicOrderingController } from './public-ordering.controller';
import { TableSessionGuard } from './table-session.guard';
import { TableSessionsService } from './table-sessions.service';

@Module({
  imports: [MenuModule, OrdersModule, BranchesCoreModule],
  controllers: [PublicOrderingController],
  providers: [TableSessionsService, TableSessionGuard],
  exports: [TableSessionsService],
})
export class TableSessionsModule {}

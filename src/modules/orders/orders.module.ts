import { Module } from '@nestjs/common';
import { BatchesModule } from '../batches/batches.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsModule } from '../products/products.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { MartSectorPlugin } from './sector-plugins/mart.plugin';
import { MedicalSectorPlugin } from './sector-plugins/medical.plugin';
import { RestaurantSectorPlugin } from './sector-plugins/restaurant.plugin';
import { SectorPluginRegistry } from './sector-plugins/registry';

@Module({
  imports: [InvoicesModule, ProductsModule, BatchesModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    MartSectorPlugin,
    MedicalSectorPlugin,
    RestaurantSectorPlugin,
    SectorPluginRegistry,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

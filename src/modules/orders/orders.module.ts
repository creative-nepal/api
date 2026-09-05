import { Module } from '@nestjs/common';
import { OrdersExportService } from './orders-export.service';
import { OrderTokensService } from './order-tokens.service';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { CashCoreModule } from '../cash/cash-core.module';
import { LoyaltyCoreModule } from '../loyalty/loyalty-core.module';
import { BatchesCoreModule } from '../batches/batches-core.module';
import { CustomersCoreModule } from '../customers/customers-core.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsCoreModule } from '../products/products-core.module';
import { ReferralsCoreModule } from '../referrals/referrals-core.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { MartSectorPlugin } from './sector-plugins/mart.plugin';
import { MedicalSectorPlugin } from './sector-plugins/medical.plugin';
import { RestaurantSectorPlugin } from './sector-plugins/restaurant.plugin';
import { ServicesSectorPlugin } from './sector-plugins/services.plugin';
import { SectorPluginRegistry } from './sector-plugins/registry';

@Module({
  imports: [
    InvoicesModule,
    ProductsCoreModule,
    BatchesCoreModule,
    BranchesCoreModule,
    CustomersCoreModule,
    CashCoreModule,
    LoyaltyCoreModule,
    ReferralsCoreModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    MartSectorPlugin,
    MedicalSectorPlugin,
    RestaurantSectorPlugin,
    ServicesSectorPlugin,
    SectorPluginRegistry,
    OrdersExportService,
    OrderTokensService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}

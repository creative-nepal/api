import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ProductsCoreModule } from './products-core.module';
import { ProductsController } from './products.controller';
import { ProductsExportService } from './products-export.service';
import { ProductsImportService } from './products-import.service';

@Module({
  imports: [ProductsCoreModule, EntitlementsModule],
  controllers: [ProductsController],
  providers: [ProductsExportService, ProductsImportService],
  exports: [ProductsCoreModule],
})
export class ProductsModule {}

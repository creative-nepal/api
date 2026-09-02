import { Module } from '@nestjs/common';
import { ProductsCoreModule } from './products-core.module';
import { ProductsController } from './products.controller';

@Module({
  imports: [ProductsCoreModule],
  controllers: [ProductsController],
  exports: [ProductsCoreModule],
})
export class ProductsModule {}

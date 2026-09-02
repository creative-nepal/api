import { Module } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

@Module({
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService, ProductsRepository],
})
export class ProductsCoreModule {}

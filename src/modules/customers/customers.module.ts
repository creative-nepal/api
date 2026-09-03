import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersCoreModule } from './customers-core.module';

@Module({
  imports: [CustomersCoreModule],
  controllers: [CustomersController],
  exports: [CustomersCoreModule],
})
export class CustomersModule {}

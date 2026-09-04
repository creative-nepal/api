import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersExportService } from './customers-export.service';
import { CustomersCoreModule } from './customers-core.module';

@Module({
  imports: [CustomersCoreModule],
  controllers: [CustomersController],
  providers: [CustomersExportService],
  exports: [CustomersCoreModule],
})
export class CustomersModule {}

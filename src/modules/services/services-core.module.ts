import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { ServicesRepository } from './services.repository';
import { ServicesService } from './services.service';

@Module({
  imports: [EntitlementsModule],
  providers: [ServicesService, ServicesRepository],
  exports: [ServicesService, ServicesRepository],
})
export class ServicesCoreModule {}

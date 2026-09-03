import { Module } from '@nestjs/common';
import { ServicesCoreModule } from './services-core.module';
import { ServicesController } from './services.controller';

@Module({
  imports: [ServicesCoreModule],
  controllers: [ServicesController],
  exports: [ServicesCoreModule],
})
export class ServicesModule {}

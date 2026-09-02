import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessesRepository],
  exports: [BusinessesService, BusinessesRepository],
})
export class BusinessesModule {}

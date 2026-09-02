import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../branches/branches-core.module';
import { TablesController } from './tables.controller';
import { TablesRepository } from './tables.repository';
import { TablesService } from './tables.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [TablesController],
  providers: [TablesService, TablesRepository],
  exports: [TablesService, TablesRepository],
})
export class TablesModule {}

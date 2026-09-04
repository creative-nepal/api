import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { TableAreasModule } from '../table-areas/table-areas.module';
import { TablesController } from './tables.controller';
import { TablesRepository } from './tables.repository';
import { TablesService } from './tables.service';

@Module({
  imports: [BranchesCoreModule, TableAreasModule],
  controllers: [TablesController],
  providers: [TablesService, TablesRepository],
  exports: [TablesService, TablesRepository],
})
export class TablesModule {}

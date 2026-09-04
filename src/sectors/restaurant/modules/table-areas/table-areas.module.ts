import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { TableAreasController } from './table-areas.controller';
import { TableAreasRepository } from './table-areas.repository';
import { TableAreasService } from './table-areas.service';

@Module({
  imports: [BranchesCoreModule],
  controllers: [TableAreasController],
  providers: [TableAreasService, TableAreasRepository],
  exports: [TableAreasService, TableAreasRepository],
})
export class TableAreasModule {}

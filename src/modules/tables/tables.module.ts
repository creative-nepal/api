import { Module } from '@nestjs/common';
import { TablesController } from './tables.controller';
import { TablesRepository } from './tables.repository';
import { TablesService } from './tables.service';

@Module({
  controllers: [TablesController],
  providers: [TablesService, TablesRepository],
  exports: [TablesService, TablesRepository],
})
export class TablesModule {}

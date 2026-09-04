import { Module } from '@nestjs/common';
import { BranchesCoreModule } from '../../../../modules/branches/branches-core.module';
import { TableSessionsModule } from '../table-sessions/table-sessions.module';
import { TablesModule } from '../tables/tables.module';
import { TableMovesController } from './table-moves.controller';
import { TableMovesService } from './table-moves.service';

@Module({
  imports: [TablesModule, TableSessionsModule, BranchesCoreModule],
  controllers: [TableMovesController],
  providers: [TableMovesService],
  exports: [TableMovesService],
})
export class TableMovesModule {}

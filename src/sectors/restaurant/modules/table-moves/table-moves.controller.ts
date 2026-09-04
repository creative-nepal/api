import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { Business } from '../../../../database/schema';
import {
  MergeTablesDto,
  TableMoveResultDto,
  TransferTableDto,
} from './dto/table-move.dto';
import { TableMovesService } from './table-moves.service';

@Controller({ path: 'businesses/:businessId/tables', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequirePermissionGuard,
  RequireSectorGuard,
  BranchScopeGuard,
)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class TableMovesController {
  constructor(private readonly tableMovesService: TableMovesService) {}

  @Post(':tableId/transfer')
  @RequirePermission({ table: ['manage'] })
  async transfer(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
    @Body() dto: TransferTableDto,
  ): Promise<TableMoveResultDto> {
    const result = await this.tableMovesService.transfer(
      business,
      tableId,
      dto.toTableId,
    );

    return new TableMoveResultDto(
      result.table.id,
      result.table.tableNo,
      result.ordersMoved,
      result.fromTableNos,
    );
  }

  @Post(':tableId/merge')
  @RequirePermission({ table: ['manage'] })
  async merge(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
    @Body() dto: MergeTablesDto,
  ): Promise<TableMoveResultDto> {
    const result = await this.tableMovesService.merge(
      business,
      tableId,
      dto.sourceTableIds,
    );

    return new TableMoveResultDto(
      result.table.id,
      result.table.tableNo,
      result.ordersMoved,
      result.fromTableNos,
    );
  }
}

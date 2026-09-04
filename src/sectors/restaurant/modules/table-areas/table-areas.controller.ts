import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../../../database/schema';
import {
  CreateTableAreaDto,
  ListTableAreasQueryDto,
  TableAreaResponseDto,
  UpdateTableAreaDto,
} from './dto/table-area.dto';
import { TableAreasService } from './table-areas.service';

@Controller({ path: 'businesses/:businessId/table-areas', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequirePermissionGuard,
  RequireSectorGuard,
  BranchScopeGuard,
)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class TableAreasController {
  constructor(private readonly tableAreasService: TableAreasService) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListTableAreasQueryDto,
  ): Promise<PaginatedResult<TableAreaResponseDto>> {
    const result = await this.tableAreasService.list({
      businessId: business.id,
      branchId: branch.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map(
        (row) => new TableAreaResponseDto(row.area, row.tableCount),
      ),
    };
  }

  @Post()
  @RequirePermission({ table: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateTableAreaDto,
  ): Promise<TableAreaResponseDto> {
    return new TableAreaResponseDto(
      await this.tableAreasService.create(business, branch.id, dto),
    );
  }

  @Patch(':areaId')
  @RequirePermission({ table: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('areaId') areaId: string,
    @Body() dto: UpdateTableAreaDto,
  ): Promise<TableAreaResponseDto> {
    return new TableAreaResponseDto(
      await this.tableAreasService.update(business, areaId, dto),
    );
  }

  @Delete(':areaId')
  @RequirePermission({ table: ['manage'] })
  async remove(
    @CurrentBusiness() business: Business,
    @Param('areaId') areaId: string,
  ): Promise<{ id: string }> {
    return this.tableAreasService.remove(business, areaId);
  }
}

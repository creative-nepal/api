import {
  Body,
  ClassSerializerInterceptor,
  Controller,
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
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../database/schema';
import {
  CreateTableDto,
  ListTablesQueryDto,
  TableResponseDto,
  UpdateTableDto,
} from './dto/table.dto';
import { TablesService } from './tables.service';

@Controller({ path: 'businesses/:businessId/tables', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequirePermissionGuard,
  RequireSectorGuard,
  BranchScopeGuard,
)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListTablesQueryDto,
  ): Promise<PaginatedResult<TableResponseDto>> {
    const result = await this.tablesService.list({
      businessId: business.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((table) => new TableResponseDto(table)),
    };
  }

  @Get(':tableId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
  ): Promise<TableResponseDto> {
    return new TableResponseDto(
      await this.tablesService.getById(business.id, tableId),
    );
  }

  @Post()
  @RequirePermission({ table: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateTableDto,
  ): Promise<TableResponseDto> {
    return new TableResponseDto(
      await this.tablesService.create(business, branch.id, dto),
    );
  }

  @Patch(':tableId')
  @RequirePermission({ table: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
    @Body() dto: UpdateTableDto,
  ): Promise<TableResponseDto> {
    return new TableResponseDto(
      await this.tablesService.update(business, tableId, dto),
    );
  }
}

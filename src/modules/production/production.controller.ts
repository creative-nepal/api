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
} from '../../common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../database/schema';
import {
  CreateProductionRunDto,
  ListProductionQueryDto,
  ProductionRunResponseDto,
  UpdateProductionRunDto,
} from './dto/production.dto';
import { ProductionService } from './production.service';

@Controller({ path: 'businesses/:businessId/production', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get()
  @RequirePermission({ production: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListProductionQueryDto,
  ): Promise<PaginatedResult<ProductionRunResponseDto>> {
    const result = await this.productionService.list(
      business.id,
      branch.id,
      query,
    );

    return {
      ...result,
      data: result.data.map((run) => new ProductionRunResponseDto(run)),
    };
  }

  @Post()
  @RequirePermission({ production: ['plan'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateProductionRunDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ProductionRunResponseDto> {
    return new ProductionRunResponseDto(
      await this.productionService.create(
        business,
        branch.id,
        dto,
        currentUser.id,
      ),
    );
  }

  @Patch(':runId')
  @RequirePermission({ production: ['record'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('runId') runId: string,
    @Body() dto: UpdateProductionRunDto,
  ): Promise<ProductionRunResponseDto> {
    return new ProductionRunResponseDto(
      await this.productionService.update(business, runId, dto),
    );
  }
}

import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
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
  CompleteStockTakeDto,
  ListStockTakesQueryDto,
  OpenStockTakeDto,
  RecordCountsDto,
} from './dto/stock-take-request.dto';
import {
  StockTakeDetailResponseDto,
  StockTakeResponseDto,
} from './dto/stock-take-response.dto';
import { StockTakesService } from './stock-takes.service';

@Controller({ path: 'businesses/:businessId/stock-takes', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequireSectorGuard,
  RequirePermissionGuard,
  BranchScopeGuard,
)
@RequireSector('mart', 'medical', 'restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class StockTakesController {
  constructor(private readonly stockTakesService: StockTakesService) {}

  @Get()
  @RequirePermission({ stocktake: ['count'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListStockTakesQueryDto,
  ): Promise<PaginatedResult<StockTakeResponseDto>> {
    const result = await this.stockTakesService.list({
      businessId: business.id,
      branchId: branch.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((row) => new StockTakeResponseDto(row)),
    };
  }

  @Get(':stockTakeId')
  @RequirePermission({ stocktake: ['count'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('stockTakeId') stockTakeId: string,
  ): Promise<StockTakeDetailResponseDto> {
    const detail = await this.stockTakesService.getById(
      business.id,
      stockTakeId,
    );

    return new StockTakeDetailResponseDto(detail.stockTake, detail.lines);
  }

  @Post()
  @RequirePermission({ stocktake: ['open'] })
  async open(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: OpenStockTakeDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<StockTakeDetailResponseDto> {
    const detail = await this.stockTakesService.open(
      business,
      branch.id,
      dto,
      currentUser.id,
    );

    return new StockTakeDetailResponseDto(detail.stockTake, detail.lines);
  }

  @Post(':stockTakeId/counts')
  @RequirePermission({ stocktake: ['count'] })
  async recordCounts(
    @CurrentBusiness() business: Business,
    @Param('stockTakeId') stockTakeId: string,
    @Body() dto: RecordCountsDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<StockTakeDetailResponseDto> {
    const detail = await this.stockTakesService.recordCounts(
      business.id,
      stockTakeId,
      dto,
      currentUser.id,
    );

    return new StockTakeDetailResponseDto(detail.stockTake, detail.lines);
  }

  @Post(':stockTakeId/complete')
  @RequirePermission({ stocktake: ['complete'] })
  async complete(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Param('stockTakeId') stockTakeId: string,
    @Body() dto: CompleteStockTakeDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{
    stockTake: StockTakeResponseDto;
    appliedLines: number;
    netVariance: number;
  }> {
    const outcome = await this.stockTakesService.complete(
      business,
      branch.id,
      stockTakeId,
      dto,
      currentUser.id,
    );

    return {
      stockTake: new StockTakeResponseDto(outcome.stockTake),
      appliedLines: outcome.appliedLines,
      netVariance: outcome.netVariance,
    };
  }

  @Post(':stockTakeId/cancel')
  @RequirePermission({ stocktake: ['complete'] })
  async cancel(
    @CurrentBusiness() business: Business,
    @Param('stockTakeId') stockTakeId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<StockTakeResponseDto> {
    const stockTake = await this.stockTakesService.cancel(
      business.id,
      stockTakeId,
      currentUser.id,
    );

    return new StockTakeResponseDto(stockTake);
  }
}

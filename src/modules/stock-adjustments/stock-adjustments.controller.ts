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
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business, StockAdjustment } from '../../database/schema';
import {
  CreateStockAdjustmentDto,
  ListStockAdjustmentsQueryDto,
} from './dto/stock-adjustment.dto';
import { StockAdjustmentsService } from './stock-adjustments.service';

@Controller({ path: 'businesses/:businessId/stock-adjustments', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListStockAdjustmentsQueryDto,
  ): Promise<PaginatedResult<StockAdjustment>> {
    return this.stockAdjustmentsService.list({
      businessId: business.id,
      ...query,
    });
  }

  @Post()
  @RequirePermission({ product: ['update'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<StockAdjustment> {
    return this.stockAdjustmentsService.create(business, dto, currentUser.id);
  }
}

@Controller({
  path: 'businesses/:businessId/products/:productId/stock',
  version: '1',
})
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductStockController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Patch()
  @RequirePermission({ product: ['update'] })
  async adjust(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
    @Body() dto: Omit<CreateStockAdjustmentDto, 'productId'>,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<StockAdjustment> {
    return this.stockAdjustmentsService.create(
      business,
      { ...dto, productId },
      currentUser.id,
    );
  }
}

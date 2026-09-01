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
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { Business } from '../../database/schema';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { BatchesService } from './batches.service';
import {
  CreateBatchDto,
  ExpiringBatchesQueryDto,
  UpdateBatchDto,
} from './dto/batch-request.dto';
import { BatchResponseDto } from './dto/batch-response.dto';

@Controller({ path: 'businesses/:businessId/batches', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class BatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get('expiring')
  async listExpiring(
    @CurrentBusiness() business: Business,
    @Query() query: ExpiringBatchesQueryDto,
  ): Promise<PaginatedResult<BatchResponseDto>> {
    const result = await this.batchesService.listExpiring(business.id, query);
    return {
      ...result,
      data: result.data.map((batch) => new BatchResponseDto(batch)),
    };
  }

  @Get(':batchId')
  async getById(
    @CurrentBusiness() business: Business,
    @Param('batchId') batchId: string,
  ): Promise<BatchResponseDto> {
    return new BatchResponseDto(
      await this.batchesService.getById(business.id, batchId),
    );
  }

  @Patch(':batchId')
  @RequirePermission({ product: ['update'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateBatchDto,
  ): Promise<BatchResponseDto> {
    return new BatchResponseDto(
      await this.batchesService.update(business.id, batchId, dto),
    );
  }
}

@Controller({
  path: 'businesses/:businessId/products/:productId/batches',
  version: '1',
})
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ProductBatchesController {
  constructor(private readonly batchesService: BatchesService) {}

  @Get()
  async list(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
  ): Promise<BatchResponseDto[]> {
    const batches = await this.batchesService.list(business.id, productId);
    return batches.map((batch) => new BatchResponseDto(batch));
  }

  @Post()
  @RequirePermission({ product: ['create'] })
  async create(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
    @Body() dto: CreateBatchDto,
  ): Promise<BatchResponseDto> {
    return new BatchResponseDto(
      await this.batchesService.create(business, productId, dto),
    );
  }
}

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
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { Business, InvoiceLease } from '../../database/schema';
import { ProductResponseDto } from '../products/dto/product-response.dto';
import {
  CreateLeaseDto,
  ReconcileLeaseDto,
  SyncProductsQueryDto,
} from './dto/lease.dto';
import { InvoiceLeasesService } from './invoice-leases.service';
import { SyncService } from './sync.service';

@Controller({ path: 'businesses/:businessId', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SyncController {
  constructor(
    private readonly leasesService: InvoiceLeasesService,
    private readonly syncService: SyncService,
  ) {}

  @Post('invoice-leases')
  @RequirePermission({ invoice: ['issue'] })
  async createLease(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateLeaseDto,
  ): Promise<InvoiceLease> {
    return this.leasesService.createLease(business, dto.deviceId, dto.size);
  }

  @Get('invoice-leases')
  async listLeases(
    @CurrentBusiness() business: Business,
  ): Promise<InvoiceLease[]> {
    return this.leasesService.listOpen(business.id);
  }

  @Post('invoice-leases/:leaseId/reconcile')
  @RequirePermission({ invoice: ['issue'] })
  async reconcile(
    @CurrentBusiness() business: Business,
    @Param('leaseId') leaseId: string,
    @Body() dto: ReconcileLeaseDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ lease: InvoiceLease; voided: number[] }> {
    return this.leasesService.reconcile(
      business,
      leaseId,
      dto.usedNumbers,
      currentUser.id,
    );
  }

  @Get('sync/products')
  async syncProducts(
    @CurrentBusiness() business: Business,
    @Query() query: SyncProductsQueryDto,
  ): Promise<{ products: ProductResponseDto[]; cursor: string | null }> {
    const delta = await this.syncService.productsSince(
      business.id,
      query.updatedSince,
      query.limit,
    );

    return {
      products: delta.products.map(
        (product) => new ProductResponseDto(product),
      ),
      cursor: delta.cursor,
    };
  }
}

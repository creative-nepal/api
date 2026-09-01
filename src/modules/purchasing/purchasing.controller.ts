import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type {
  Business,
  PurchaseBill,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
} from '../../database/schema';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  CreatePurchaseBillDto,
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ListPurchaseQueryDto,
  RecordPaymentDto,
  ReceivePurchaseOrderDto,
} from './dto/purchasing.dto';
import { PurchaseRegisterService } from './purchase-register.service';
import { PurchasingService } from './purchasing.service';
import { TdsReportService } from './tds-report.service';

class RegisterQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsIn(['xlsx', 'csv']) format?: 'xlsx' | 'csv';
}

@Controller({ path: 'businesses/:businessId', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class PurchasingController {
  constructor(
    private readonly purchasingService: PurchasingService,
    private readonly registerService: PurchaseRegisterService,
    private readonly tdsReportService: TdsReportService,
  ) {}

  @Get('suppliers')
  async listSuppliers(
    @CurrentBusiness() business: Business,
    @Query() query: ListPurchaseQueryDto,
  ): Promise<PaginatedResult<Supplier>> {
    return this.purchasingService.listSuppliers(business.id, query);
  }

  @Post('suppliers')
  @RequirePermission({ product: ['create'] })
  async createSupplier(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateSupplierDto,
  ): Promise<Supplier> {
    return this.purchasingService.createSupplier(business.id, dto);
  }

  @Get('purchase-orders')
  async listPurchaseOrders(
    @CurrentBusiness() business: Business,
    @Query() query: ListPurchaseQueryDto,
  ): Promise<PaginatedResult<PurchaseOrder>> {
    return this.purchasingService.listPurchaseOrders(business.id, query);
  }

  @Get('purchase-orders/:poId')
  async getPurchaseOrder(
    @CurrentBusiness() business: Business,
    @Param('poId') poId: string,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    return this.purchasingService.getPurchaseOrder(business.id, poId);
  }

  @Post('purchase-orders')
  @RequirePermission({ product: ['create'] })
  async createPurchaseOrder(
    @CurrentBusiness() business: Business,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    return this.purchasingService.createPurchaseOrder(
      business,
      dto,
      currentUser.id,
    );
  }

  @Post('purchase-orders/:poId/confirm')
  @RequirePermission({ product: ['update'] })
  async confirm(
    @CurrentBusiness() business: Business,
    @Param('poId') poId: string,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.confirmPurchaseOrder(business.id, poId);
  }

  @Post('purchase-orders/:poId/receive')
  @RequirePermission({ product: ['update'] })
  async receive(
    @CurrentBusiness() business: Business,
    @Param('poId') poId: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ order: PurchaseOrder; items: PurchaseOrderItem[] }> {
    return this.purchasingService.receive(business, poId, dto, currentUser.id);
  }

  @Get('purchase-bills')
  async listBills(
    @CurrentBusiness() business: Business,
    @Query() query: ListPurchaseQueryDto,
  ): Promise<PaginatedResult<PurchaseBill>> {
    return this.purchasingService.listBills(business.id, query);
  }

  @Post('purchase-bills')
  @RequirePermission({ product: ['create'] })
  async createBill(
    @CurrentBusiness() business: Business,
    @Body() dto: CreatePurchaseBillDto,
  ): Promise<PurchaseBill> {
    return this.purchasingService.createBill(business.id, dto);
  }

  @Post('purchase-bills/:billId/payments')
  @RequirePermission({ product: ['update'] })
  async recordPayment(
    @CurrentBusiness() business: Business,
    @Param('billId') billId: string,
    @Body() dto: RecordPaymentDto,
  ): Promise<PurchaseBill> {
    return this.purchasingService.recordPayment(
      business.id,
      billId,
      dto.amountCents,
    );
  }

  @Get('purchases/tds-return')
  async tdsReturn(
    @CurrentBusiness() business: Business,
    @Query() query: RegisterQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.tdsReportService.export(
      business,
      query.from,
      query.to,
      query.format ?? 'xlsx',
    );

    response
      .status(200)
      .setHeader('Content-Type', file.contentType)
      .setHeader('X-Total-Tds-Cents', String(file.totalTdsCents))
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${file.filename}"`,
      )
      .send(file.body);
  }

  @Get('purchases/register')
  async register(
    @CurrentBusiness() business: Business,
    @Query() query: RegisterQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.registerService.export(
      business,
      query.from,
      query.to,
      query.format ?? 'xlsx',
    );

    response
      .status(200)
      .setHeader('Content-Type', file.contentType)
      .setHeader(
        'Content-Disposition',
        `attachment; filename="${file.filename}"`,
      )
      .send(file.body);
  }
}

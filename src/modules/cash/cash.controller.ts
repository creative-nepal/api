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
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type {
  Branch,
  Business,
  CashMovement,
  CashSession,
  InvoicePayment,
} from '../../database/schema';
import { CashService, type CashSessionSummary } from './cash.service';
import {
  CashMovementDto,
  CloseCashSessionDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
  RecordPaymentsDto,
} from './dto/cash.dto';

@Controller({ path: 'businesses/:businessId/cash-sessions', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CashSessionsController {
  constructor(private readonly cashService: CashService) {}

  @Get('current')
  @RequirePermission({ cash: ['view'] })
  async current(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
  ): Promise<CashSessionSummary | null> {
    return this.cashService.current(business.id, branch.id);
  }

  @Get()
  @RequirePermission({ cash: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListCashSessionsQueryDto,
  ): Promise<PaginatedResult<CashSession>> {
    return this.cashService.list({
      businessId: business.id,
      branchId: branch.id,
      ...query,
    });
  }

  @Get(':sessionId')
  @RequirePermission({ cash: ['view'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('sessionId') sessionId: string,
  ): Promise<CashSessionSummary> {
    return this.cashService.getById(business.id, sessionId);
  }

  @Post()
  @RequirePermission({ cash: ['open'] })
  async open(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: OpenCashSessionDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CashSession> {
    return this.cashService.open(business.id, branch.id, dto, currentUser.id);
  }

  @Post(':sessionId/movements')
  @RequirePermission({ cash: ['move'] })
  async addMovement(
    @CurrentBusiness() business: Business,
    @Param('sessionId') sessionId: string,
    @Body() dto: CashMovementDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CashMovement> {
    return this.cashService.addMovement(
      business.id,
      sessionId,
      dto,
      currentUser.id,
    );
  }

  @Post(':sessionId/close')
  @RequirePermission({ cash: ['close'] })
  async close(
    @CurrentBusiness() business: Business,
    @Param('sessionId') sessionId: string,
    @Body() dto: CloseCashSessionDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CashSessionSummary> {
    return this.cashService.close(business.id, sessionId, dto, currentUser.id);
  }
}

@Controller({
  path: 'businesses/:businessId/invoices/:invoiceId/payments',
  version: '1',
})
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class InvoicePaymentsController {
  constructor(private readonly cashService: CashService) {}

  @Get()
  @RequirePermission({ invoice: ['print'] })
  async list(
    @CurrentBusiness() business: Business,
    @Param('invoiceId') invoiceId: string,
  ): Promise<InvoicePayment[]> {
    return this.cashService.paymentsForInvoice(business.id, invoiceId);
  }

  @Post()
  @RequirePermission({ cash: ['take-payment'] })
  async settle(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: RecordPaymentsDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InvoicePayment[]> {
    return this.cashService.settleInvoice(
      business.id,
      branch.id,
      invoiceId,
      dto.payments,
      currentUser.id,
    );
  }
}

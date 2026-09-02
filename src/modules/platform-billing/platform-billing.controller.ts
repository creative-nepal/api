import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { CurrentUser, type CurrentUserType } from '../../auth';
import type { PaymentMethod, PlatformInvoice } from '../../database/schema';
import {
  type PaginatedResult,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { AddPaymentMethodDto } from './dto/platform-billing.dto';
import { PaymentMethodsService } from './payment-methods.service';
import { PlatformBillingRepository } from './platform-billing.repository';
import {
  type BillingRunSummary,
  PlatformBillingService,
} from './platform-billing.service';

interface PaymentMethodView {
  id: string;
  provider: string;
  displayLabel: string;
  isDefault: boolean;
}

@Controller({ path: 'billing', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class PlatformBillingController {
  constructor(
    private readonly paymentMethodsService: PaymentMethodsService,
    private readonly billingService: PlatformBillingService,
    private readonly repository: PlatformBillingRepository,
  ) {}

  @Get('payment-methods')
  async listPaymentMethods(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaymentMethodView[]> {
    const methods = await this.paymentMethodsService.list(currentUser.id);
    return methods.map((method: PaymentMethod) => ({
      id: method.id,
      provider: method.provider,
      displayLabel: method.displayLabel,
      isDefault: method.isDefault,
    }));
  }

  @Post('payment-methods')
  async addPaymentMethod(
    @CurrentUser() currentUser: CurrentUserType,
    @Body() dto: AddPaymentMethodDto,
  ): Promise<PaymentMethodView> {
    const method = await this.paymentMethodsService.add(currentUser.id, dto);
    return {
      id: method.id,
      provider: method.provider,
      displayLabel: method.displayLabel,
      isDefault: method.isDefault,
    };
  }

  @Delete('payment-methods/:id')
  async removePaymentMethod(
    @CurrentUser() currentUser: CurrentUserType,
    @Param('id') id: string,
  ): Promise<{ id: string; removed: true }> {
    await this.paymentMethodsService.remove(currentUser.id, id);
    return { id, removed: true };
  }

  @Get('invoices')
  async listInvoices(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<PlatformInvoice>> {
    const { rows, total } = await this.repository.findInvoicesForUser(
      currentUser.id,
      query.limit,
      query.offset,
    );

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  @Get('platform/invoices')
  @UserHasPermission({ permissions: { subscription: ['view-any'] } })
  async listAllInvoices(@Query() query: PaginationQueryDto): Promise<{
    data: Array<{ invoice: PlatformInvoice; accountEmail: string | null }>;
    total: number;
    totals: Record<string, { count: number; cents: number }>;
  }> {
    const [data, total, totals] = await Promise.all([
      this.repository.findAllInvoices(query.limit, query.offset),
      this.repository.countAllInvoices(),
      this.repository.invoiceTotals(),
    ]);

    return { data, total, totals };
  }

  @Post('run')
  @UserHasPermission({ permissions: { subscription: ['assign'] } })
  async runBilling(): Promise<BillingRunSummary> {
    return this.billingService.runBilling();
  }

  @Post('consolidate')
  @UserHasPermission({ permissions: { subscription: ['assign'] } })
  async consolidate(): Promise<{ closed: number }> {
    return { closed: await this.billingService.consolidate() };
  }
}

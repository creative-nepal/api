import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../common';
import type { Business } from '../../database/schema';
import { InvoiceResponseDto } from '../invoices/dto/invoice-response.dto';
import { BillTableDto } from './dto/bill-table.dto';
import { TableBillingService } from './table-billing.service';

@Controller({ path: 'businesses/:businessId/tables/:tableId', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, RequireSectorGuard)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class TableBillingController {
  constructor(private readonly tableBillingService: TableBillingService) {}

  @Post('bill')
  @RequirePermission({ invoice: ['issue'] })
  async bill(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
    @Body() dto: BillTableDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InvoiceResponseDto[]> {
    const invoices = await this.tableBillingService.billTable(
      business,
      tableId,
      dto,
      currentUser.id,
    );

    return invoices.map((invoice) => new InvoiceResponseDto(invoice));
  }

  @Post('close')
  @RequirePermission({ table: ['manage'] })
  async close(
    @CurrentBusiness() business: Business,
    @Param('tableId') tableId: string,
  ): Promise<{ tableId: string; status: string }> {
    await this.tableBillingService.closeTable(business, tableId);
    return { tableId, status: 'empty' };
  }
}

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
import type { Response } from 'express';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business, InvoiceAuditLogRow } from '../../database/schema';
import {
  ExportRegisterQueryDto,
  IssueCreditNoteDto,
  ListInvoicesQueryDto,
} from './dto/invoice-request.dto';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import { InvoicesService } from './invoices.service';
import { RegistersService } from './registers.service';

@Controller({ path: 'businesses/:businessId/invoices', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly registersService: RegistersService,
  ) {}

  @Get()
  @RequirePermission({ invoice: ['print'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListInvoicesQueryDto,
  ): Promise<PaginatedResult<InvoiceResponseDto>> {
    const result = await this.invoicesService.list({
      businessId: business.id,
      ...query,
    });

    return {
      ...result,
      data: result.data.map((invoice) => new InvoiceResponseDto(invoice)),
    };
  }

  @Get('registers')
  @RequirePermission({ invoice: ['print'] })
  async exportRegister(
    @CurrentBusiness() business: Business,
    @Query() query: ExportRegisterQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.registersService.export(
      business,
      query.fiscalYear,
      query.format ?? 'xlsx',
      query.branchId,
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

  @Get(':invoiceId')
  @RequirePermission({ invoice: ['print'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('invoiceId') invoiceId: string,
  ): Promise<InvoiceResponseDto> {
    return new InvoiceResponseDto(
      await this.invoicesService.getById(business.id, invoiceId),
    );
  }

  @Get(':invoiceId/audit-log')
  @RequirePermission({ invoice: ['print'] })
  async getAuditLog(
    @CurrentBusiness() business: Business,
    @Param('invoiceId') invoiceId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<InvoiceAuditLogRow>> {
    const data = await this.invoicesService.getAuditLog(business.id, invoiceId);
    return {
      data: data.slice(query.offset, query.offset + query.limit),
      total: data.length,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Post(':invoiceId/print')
  @RequirePermission({ invoice: ['print'] })
  async print(
    @CurrentBusiness() business: Business,
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InvoiceResponseDto> {
    return new InvoiceResponseDto(
      await this.invoicesService.recordPrint(
        business.id,
        invoiceId,
        currentUser.id,
      ),
    );
  }

  @Post(':invoiceId/credit-note')
  @RequirePermission({ invoice: ['credit-note'] })
  async issueCreditNote(
    @CurrentBusiness() business: Business,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: IssueCreditNoteDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InvoiceResponseDto> {
    return new InvoiceResponseDto(
      await this.invoicesService.issueCreditNote(business, invoiceId, {
        subtotalCents: dto.subtotalCents,
        reason: dto.reason,
        actorUserId: currentUser.id,
      }),
    );
  }
}

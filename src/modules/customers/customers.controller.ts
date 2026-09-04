import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
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
import {
  type PaginatedResult,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import type {
  Business,
  Customer,
  CustomerLedgerEntry,
} from '../../database/schema';
import { CustomersService } from './customers.service';
import { ExportQueryDto, sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import type { ImportSummary } from '../products/products-import.service';
import { CustomersExportService } from './customers-export.service';
import { ImportCustomersDto } from './dto/customer-import.dto';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  RecordPaymentDto,
  UpdateCustomerDto,
} from './dto/customers.dto';

@Controller({ path: 'businesses/:businessId/customers', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly exportService: CustomersExportService,
  ) {}

  @Get('export')
  @RequirePermission({ order: ['create'] })
  async export(
    @CurrentBusiness() business: Business,
    @Query() query: ExportQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.exportService.export(
        business,
        query.format ?? 'xlsx',
        query.limit ?? 5_000,
      ),
    );
  }

  @Post('import')
  @RequirePermission({ business: ['manage'] })
  async import(
    @CurrentBusiness() business: Business,
    @Body() dto: ImportCustomersDto,
  ): Promise<ImportSummary> {
    return this.exportService.import(business, dto);
  }

  @Get()
  @RequirePermission({ order: ['create'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListCustomersQueryDto,
  ): Promise<PaginatedResult<Customer>> {
    return this.customers.list(business.id, query);
  }

  @Post()
  @RequirePermission({ order: ['create'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateCustomerDto,
  ): Promise<Customer> {
    return this.customers.create(business.id, dto);
  }

  @Get(':customerId')
  @RequirePermission({ order: ['create'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
  ): Promise<Customer> {
    return this.customers.getById(business.id, customerId);
  }

  @Patch(':customerId')
  @RequirePermission({ invoice: ['credit-note'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customers.update(business.id, customerId, dto);
  }

  @Get(':customerId/ledger')
  @RequirePermission({ invoice: ['print'] })
  async ledger(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<CustomerLedgerEntry>> {
    return this.customers.ledger(
      business.id,
      customerId,
      query.limit,
      query.offset,
    );
  }

  @Post(':customerId/payments')
  @RequirePermission({ invoice: ['issue'] })
  async recordPayment(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<CustomerLedgerEntry> {
    return this.customers.recordPayment(
      business.id,
      customerId,
      dto.amountCents,
      dto.note ?? null,
      currentUser.id,
    );
  }
}

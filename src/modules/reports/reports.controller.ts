import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import { sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import type { Branch, Business } from '../../database/schema';
import {
  AsOfQueryDto,
  PeriodQueryDto,
  StockMovementQueryDto,
} from './dto/report-query.dto';
import { type AgingReport, LedgersService } from './ledgers.service';
import { type ProfitReport, ProfitService } from './profit.service';
import { ReportsExportService } from './reports-export.service';
import {
  type StockMovementReport,
  StockMovementService,
} from './stock-movement.service';

const DEFAULT_WINDOW_DAYS = 30;

function period(query: PeriodQueryDto): { from: Date; to: Date } {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 86_400_000);

  return { from, to };
}

@Controller({ path: 'businesses/:businessId/reports', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ReportsController {
  constructor(
    private readonly profitService: ProfitService,
    private readonly ledgersService: LedgersService,
    private readonly stockMovementService: StockMovementService,
    private readonly exportService: ReportsExportService,
  ) {}

  @Get('profit')
  @RequirePermission({ report: ['view'] })
  async profit(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: PeriodQueryDto,
  ): Promise<ProfitReport> {
    const { from, to } = period(query);

    return this.profitService.getReport(business.id, branch.id, from, to);
  }

  @Get('profit/export')
  @RequirePermission({ report: ['view'] })
  async profitExport(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: PeriodQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    const { from, to } = period(query);

    sendReport(
      response,
      await this.exportService.profit(
        await this.profitService.getReport(business.id, branch.id, from, to),
        business.legalName,
        query.format ?? 'xlsx',
      ),
    );
  }

  @Get('receivables')
  @RequirePermission({ report: ['view'] })
  async receivables(
    @CurrentBusiness() business: Business,
    @Query() query: AsOfQueryDto,
  ): Promise<AgingReport> {
    return this.ledgersService.receivables(
      business.id,
      query.asOf ? new Date(query.asOf) : new Date(),
    );
  }

  @Get('receivables/export')
  @RequirePermission({ report: ['view'] })
  async receivablesExport(
    @CurrentBusiness() business: Business,
    @Query() query: AsOfQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.exportService.aging(
        await this.ledgersService.receivables(
          business.id,
          query.asOf ? new Date(query.asOf) : new Date(),
        ),
        business.legalName,
        'receivables',
        query.format ?? 'xlsx',
      ),
    );
  }

  @Get('payables')
  @RequirePermission({ report: ['view'] })
  async payables(
    @CurrentBusiness() business: Business,
    @Query() query: AsOfQueryDto,
  ): Promise<AgingReport> {
    return this.ledgersService.payables(
      business.id,
      query.asOf ? new Date(query.asOf) : new Date(),
    );
  }

  @Get('payables/export')
  @RequirePermission({ report: ['view'] })
  async payablesExport(
    @CurrentBusiness() business: Business,
    @Query() query: AsOfQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.exportService.aging(
        await this.ledgersService.payables(
          business.id,
          query.asOf ? new Date(query.asOf) : new Date(),
        ),
        business.legalName,
        'payables',
        query.format ?? 'xlsx',
      ),
    );
  }

  @Get('stock-movement')
  @RequirePermission({ report: ['view'] })
  async stockMovement(
    @CurrentBusiness() business: Business,
    @Query() query: StockMovementQueryDto,
  ): Promise<StockMovementReport> {
    const { from, to } = period(query);

    return this.stockMovementService.getReport(
      business.id,
      query.productId,
      from,
      to,
    );
  }

  @Get('stock-movement/export')
  @RequirePermission({ report: ['view'] })
  async stockMovementExport(
    @CurrentBusiness() business: Business,
    @Query() query: StockMovementQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    const { from, to } = period(query);

    sendReport(
      response,
      await this.exportService.stockMovement(
        await this.stockMovementService.getReport(
          business.id,
          query.productId,
          from,
          to,
        ),
        business.legalName,
        query.format ?? 'xlsx',
      ),
    );
  }
}

import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Post,
  Query,
  Res,
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
import type { Branch, Business, Expense } from '../../database/schema';
import {
  CreateExpenseDto,
  ExpenseReportQueryDto,
  ListExpensesQueryDto,
} from './dto/expense.dto';
import { ExportQueryDto, sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import { ExpensesService, type ExpenseReport } from './expenses.service';

@Controller({ path: 'businesses/:businessId/expenses', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermission({ expense: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ListExpensesQueryDto,
  ): Promise<PaginatedResult<Expense>> {
    return this.expensesService.list(business.id, branch.id, query);
  }

  @Get('export')
  @RequirePermission({ expense: ['view'] })
  async export(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ExportQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.expensesService.export(
        business,
        branch.id,
        query.format ?? 'xlsx',
        query.limit ?? 5_000,
      ),
    );
  }

  @Get('report')
  @RequirePermission({ expense: ['view'] })
  async report(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: ExpenseReportQueryDto,
  ): Promise<ExpenseReport> {
    return this.expensesService.report(
      business.id,
      branch.id,
      query.sinceDays ?? 30,
    );
  }

  @Post()
  @RequirePermission({ expense: ['record'] })
  async create(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<Expense> {
    return this.expensesService.create(
      business.id,
      branch.id,
      dto,
      currentUser.id,
    );
  }
}

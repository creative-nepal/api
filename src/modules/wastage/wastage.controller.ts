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
  RequireSector,
  RequireSectorGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch, Business, WastageRecord } from '../../database/schema';
import {
  ListWastageQueryDto,
  RecordWastageDto,
  WastageReportQueryDto,
} from './dto/wastage.dto';
import { ExportQueryDto, sendReport } from '../../common/reporting';
import type { DownloadResponse } from '../../common/reporting/spreadsheet';
import { WastageService, type WastageReport } from './wastage.service';

@Controller({ path: 'businesses/:businessId/wastage', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequireSectorGuard,
  RequirePermissionGuard,
  BranchScopeGuard,
)
@RequireSector('mart', 'medical', 'restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class WastageController {
  constructor(private readonly wastageService: WastageService) {}

  @Get()
  @RequirePermission({ wastage: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListWastageQueryDto,
  ): Promise<PaginatedResult<WastageRecord>> {
    return this.wastageService.list(business.id, query);
  }

  @Get('export')
  @RequirePermission({ wastage: ['view'] })
  async export(
    @CurrentBusiness() business: Business,
    @Query() query: ExportQueryDto,
    @Res() response: DownloadResponse,
  ): Promise<void> {
    sendReport(
      response,
      await this.wastageService.export(
        business,
        query.format ?? 'xlsx',
        query.limit ?? 5_000,
      ),
    );
  }

  @Get('report')
  @RequirePermission({ wastage: ['view'] })
  async report(
    @CurrentBusiness() business: Business,
    @Query() query: WastageReportQueryDto,
  ): Promise<WastageReport> {
    return this.wastageService.report(business.id, query.sinceDays ?? 30);
  }

  @Post()
  @RequirePermission({ wastage: ['record'] })
  async record(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Body() dto: RecordWastageDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<WastageRecord> {
    return this.wastageService.record(business, branch.id, dto, currentUser.id);
  }
}

import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsISO8601, IsOptional } from 'class-validator';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { Branch, Business } from '../../database/schema';
import { type LiveSalesReport, LiveSalesService } from './live-sales.service';

class LiveSalesQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  businessDate?: string;
}

@Controller({ path: 'businesses/:businessId/live-sales', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, BranchScopeGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class LiveSalesController {
  constructor(private readonly liveSalesService: LiveSalesService) {}

  @Get()
  @RequirePermission({ report: ['view'] })
  async get(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Query() query: LiveSalesQueryDto,
  ): Promise<LiveSalesReport> {
    return this.liveSalesService.getReport(
      business.id,
      branch.id,
      query.businessDate,
    );
  }
}

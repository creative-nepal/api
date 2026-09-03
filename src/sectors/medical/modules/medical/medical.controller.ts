import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  Business,
  ControlledSubstanceEntry,
  InsuranceClaim,
} from '../../../../database/schema';
import { BatchReportService } from './batch-report.service';
import { MedicalService } from './medical.service';

class BatchReportQueryDto {
  @IsOptional()
  @IsString()
  fiscalYear?: string;

  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

@Controller({ path: 'businesses/:businessId/medical', version: '1' })
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('medical')
@UseInterceptors(ClassSerializerInterceptor)
export class MedicalController {
  constructor(
    private readonly medicalService: MedicalService,
    private readonly batchReportService: BatchReportService,
  ) {}

  @Get('controlled-register')
  @RequirePermission({ dispense: ['controlled'] })
  async listControlledRegister(
    @CurrentBusiness() business: Business,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<ControlledSubstanceEntry>> {
    return this.medicalService.listControlledRegister(
      business.id,
      query.limit,
      query.offset,
    );
  }

  @Get('insurance-claims')
  @RequirePermission({ invoice: ['print'] })
  async listInsuranceClaims(
    @CurrentBusiness() business: Business,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<InsuranceClaim>> {
    return this.medicalService.listInsuranceClaims(
      business.id,
      query.limit,
      query.offset,
    );
  }

  @Get('reports/batch-wise')
  @RequirePermission({ product: ['update'] })
  async batchReport(
    @CurrentBusiness() business: Business,
    @Query() query: BatchReportQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.batchReportService.export(
      business,
      query.fiscalYear,
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

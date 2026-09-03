import {
  Param,
  Patch,
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
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CurrentUser, type CurrentUserType } from '../../../../auth';
import type { Response } from 'express';
import {
  BranchScopeGuard,
  BusinessAccessGuard,
  CurrentBranch,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  Branch,
  Business,
  ControlledSubstanceEntry,
  InsuranceClaim,
} from '../../../../database/schema';
import { BatchReportService } from './batch-report.service';
import { ClaimsService } from './claims.service';
import { TransitionClaimDto } from './dto/claims.dto';
import { MedicalService } from './medical.service';
import { type RecallReport, RecallService } from './recall.service';
import {
  type SubstituteResult,
  SubstitutesService,
} from './substitutes.service';

class BatchReportQueryDto {
  @IsOptional()
  @IsString()
  fiscalYear?: string;

  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

@Controller({ path: 'businesses/:businessId/medical', version: '1' })
@UseGuards(
  BusinessAccessGuard,
  RequireSectorGuard,
  RequirePermissionGuard,
  BranchScopeGuard,
)
@RequireSector('medical')
@UseInterceptors(ClassSerializerInterceptor)
export class MedicalController {
  constructor(
    private readonly medicalService: MedicalService,
    private readonly batchReportService: BatchReportService,
    private readonly claims: ClaimsService,
    private readonly substitutes: SubstitutesService,
    private readonly recall: RecallService,
  ) {}

  @Get('products/:productId/substitutes')
  @RequirePermission({ order: ['create'] })
  async substitutesFor(
    @CurrentBusiness() business: Business,
    @Param('productId') productId: string,
  ): Promise<SubstituteResult> {
    return this.substitutes.findFor(business.id, productId);
  }

  @Get('batches/:batchId/recall')
  @RequirePermission({ recall: ['view'] })
  async recallReport(
    @CurrentBusiness() business: Business,
    @Param('batchId') batchId: string,
  ): Promise<RecallReport> {
    return this.recall.report(business.id, batchId);
  }

  @Post('batches/:batchId/recall')
  @RequirePermission({ recall: ['quarantine'] })
  async quarantineBatch(
    @CurrentBusiness() business: Business,
    @CurrentBranch() branch: Branch,
    @Param('batchId') batchId: string,
    @Body() body: { note?: string },
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<RecallReport> {
    return this.recall.quarantine(
      business,
      branch.id,
      batchId,
      currentUser.id,
      body?.note,
    );
  }

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

  @Patch('insurance-claims/:claimId/status')
  @RequirePermission({ invoice: ['credit-note'] })
  async transitionClaim(
    @CurrentBusiness() business: Business,
    @Param('claimId') claimId: string,
    @Body() dto: TransitionClaimDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<InsuranceClaim> {
    return this.claims.transition(business.id, claimId, dto, currentUser.id);
  }

  @Get('insurance-claims/:claimId/history')
  @RequirePermission({ invoice: ['print'] })
  async claimHistory(
    @CurrentBusiness() business: Business,
    @Param('claimId') claimId: string,
  ) {
    return this.claims.history(business.id, claimId);
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

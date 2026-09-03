import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { Branch } from '../../database/schema';
import { BranchesService } from '../branches/branches.service';
import { BusinessesService } from './businesses.service';
import { BusinessResponseDto } from './dto/business-response.dto';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import {
  UpdateBusinessComplianceDto,
  UpdateBusinessStatusDto,
} from './dto/update-business.dto';

@Controller({ path: 'businesses', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class BusinessesAdminController {
  constructor(
    private readonly businessesService: BusinessesService,
    private readonly branchesService: BranchesService,
  ) {}

  @Get()
  @UserHasPermission({ permissions: { business: ['list-all'] } })
  async list(
    @Query() query: ListBusinessesQueryDto,
  ): Promise<PaginatedResult<BusinessResponseDto>> {
    const result = await this.businessesService.list(query);

    return {
      ...result,
      data: result.data.map((business) => new BusinessResponseDto(business)),
    };
  }

  @Get(':businessId')
  @UserHasPermission({ permissions: { business: ['view-any'] } })
  async getById(
    @Param('businessId') businessId: string,
  ): Promise<BusinessResponseDto> {
    return new BusinessResponseDto(
      await this.businessesService.getById(businessId),
    );
  }

  @Get(':businessId/branches')
  @UserHasPermission({ permissions: { business: ['view-any'] } })
  async listBranches(
    @Param('businessId') businessId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<Branch>> {
    return this.branchesService.list(businessId, {
      limit: query.limit,
      offset: query.offset,
      sortDirection: 'desc',
    });
  }

  @Patch(':businessId/status')
  @UserHasPermission({ permissions: { business: ['suspend', 'close'] } })
  async setStatus(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessStatusDto,
  ): Promise<BusinessResponseDto> {
    return new BusinessResponseDto(
      await this.businessesService.setStatus(businessId, dto.status),
    );
  }

  @Patch(':businessId/compliance')
  @UserHasPermission({ permissions: { business: ['set-compliance'] } })
  async setCompliance(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessComplianceDto,
  ): Promise<BusinessResponseDto> {
    return new BusinessResponseDto(
      await this.businessesService.update(businessId, dto),
    );
  }
}

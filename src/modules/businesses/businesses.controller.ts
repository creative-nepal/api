import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../database/schema';
import { BranchesService } from '../branches/branches.service';
import { BusinessesService } from './businesses.service';
import { BusinessResponseDto } from './dto/business-response.dto';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import {
  UpdateBusinessComplianceDto,
  UpdateBusinessDto,
  UpdateBusinessStatusDto,
} from './dto/update-business.dto';

@Controller({ path: 'businesses', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class BusinessesController {
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
    return this.toPaginatedResponse(result);
  }

  @Get('me')
  async listMine(
    @CurrentUser() currentUser: CurrentUserType,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<BusinessResponseDto>> {
    const result = await this.businessesService.listForUser(
      currentUser.id,
      query.limit,
      query.offset,
    );
    return this.toPaginatedResponse(result);
  }

  @Get(':businessId')
  @UserHasPermission({ permissions: { business: ['view-any'] } })
  async getById(
    @Param('businessId') businessId: string,
  ): Promise<BusinessResponseDto> {
    const found = await this.businessesService.getById(businessId);
    return new BusinessResponseDto(found);
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

  @Patch(':businessId')
  @UseGuards(BusinessAccessGuard, RequirePermissionGuard)
  @RequirePermission({ business: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Body() dto: UpdateBusinessDto,
  ): Promise<BusinessResponseDto> {
    const updated = await this.businessesService.update(business.id, dto);
    return new BusinessResponseDto(updated);
  }

  @Patch(':businessId/status')
  @UserHasPermission({ permissions: { business: ['suspend', 'close'] } })
  async setStatus(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessStatusDto,
  ): Promise<BusinessResponseDto> {
    const updated = await this.businessesService.setStatus(
      businessId,
      dto.status,
    );
    return new BusinessResponseDto(updated);
  }

  @Patch(':businessId/compliance')
  @UserHasPermission({ permissions: { business: ['set-compliance'] } })
  async setCompliance(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessComplianceDto,
  ): Promise<BusinessResponseDto> {
    const updated = await this.businessesService.update(businessId, dto);
    return new BusinessResponseDto(updated);
  }

  private toPaginatedResponse(
    result: PaginatedResult<Business>,
  ): PaginatedResult<BusinessResponseDto> {
    return {
      ...result,
      data: result.data.map((business) => new BusinessResponseDto(business)),
    };
  }
}

import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch, Business } from '../../database/schema';
import { BranchesService } from './branches.service';
import {
  CreateBranchDto,
  ListBranchesQueryDto,
  UpdateBranchDto,
} from './dto/branches.dto';

@Controller({ path: 'businesses/:businessId/branches', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @RequirePermission({ invoice: ['print'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListBranchesQueryDto,
  ): Promise<PaginatedResult<Branch>> {
    return this.branchesService.list(business.id, query);
  }

  @Post()
  @RequirePermission({ business: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateBranchDto,
  ): Promise<Branch> {
    return this.branchesService.create(business.id, dto);
  }

  @Get(':branchId')
  @RequirePermission({ invoice: ['print'] })
  async getById(
    @CurrentBusiness() business: Business,
    @Param('branchId') branchId: string,
  ): Promise<Branch> {
    return this.branchesService.getById(business.id, branchId);
  }

  @Patch(':branchId')
  @RequirePermission({ business: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('branchId') branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<Branch> {
    return this.branchesService.update(business.id, branchId, dto);
  }
}

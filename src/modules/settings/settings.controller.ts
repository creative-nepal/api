import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type {
  BranchRole,
  Business,
  BusinessSettings,
} from '../../database/schema';
import {
  type BranchRoleView,
  BranchRolesService,
} from './branch-roles.service';
import { SetBranchRoleDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller({ path: 'businesses/:businessId/settings', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly branchRolesService: BranchRolesService,
  ) {}

  @Get()
  @RequirePermission({ order: ['create'] })
  async get(@CurrentBusiness() business: Business): Promise<BusinessSettings> {
    return this.settingsService.get(business.id);
  }

  @Patch()
  @RequirePermission({ business: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Body() dto: UpdateSettingsDto,
  ): Promise<BusinessSettings> {
    return this.settingsService.update(business.id, dto);
  }

  @Get('branch-roles')
  @RequirePermission({ member: ['create'] })
  async listBranchRoles(
    @CurrentBusiness() business: Business,
  ): Promise<BranchRoleView[]> {
    return this.branchRolesService.listForBusiness(business.id);
  }

  @Put('branch-roles/:branchId/:userId')
  @RequirePermission({ member: ['update'] })
  async setBranchRole(
    @CurrentBusiness() business: Business,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
    @Body() dto: SetBranchRoleDto,
  ): Promise<BranchRole> {
    return this.branchRolesService.set(business, branchId, userId, dto.role);
  }

  @Delete('branch-roles/:branchId/:userId')
  @RequirePermission({ member: ['update'] })
  async clearBranchRole(
    @CurrentBusiness() business: Business,
    @Param('branchId') branchId: string,
    @Param('userId') userId: string,
  ): Promise<{ cleared: true }> {
    await this.branchRolesService.clear(business.id, branchId, userId);
    return { cleared: true };
  }
}

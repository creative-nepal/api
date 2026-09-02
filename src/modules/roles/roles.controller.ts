import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { Business } from '../../database/schema';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import type { RoleCatalogue, RoleView } from './roles.service';
import { RolesService } from './roles.service';

@Controller({ path: 'businesses/:businessId/roles', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission({ ac: ['read'] })
  async list(@CurrentBusiness() business: Business): Promise<RoleCatalogue> {
    return this.rolesService.list(business);
  }

  @Post()
  @RequirePermission({ ac: ['create'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleView> {
    return this.rolesService.create(business, dto.role, dto.permission);
  }

  @Patch(':role')
  @RequirePermission({ ac: ['update'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('role') role: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleView> {
    return this.rolesService.update(business, role, dto.permission ?? {});
  }

  @Delete(':role')
  @RequirePermission({ ac: ['delete'] })
  async remove(
    @CurrentBusiness() business: Business,
    @Param('role') role: string,
  ): Promise<{ role: string }> {
    return this.rolesService.remove(business, role);
  }
}

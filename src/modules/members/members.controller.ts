import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Put,
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
import type { Business } from '../../database/schema';
import { ListMembersQueryDto, SetMemberBranchesDto } from './dto/member.dto';
import { type MemberView, MembersService } from './members.service';

@Controller({ path: 'businesses/:businessId/members', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermission({ member: ['create'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListMembersQueryDto,
  ): Promise<PaginatedResult<MemberView>> {
    return this.membersService.list(business, query);
  }

  @Put(':memberId/branches')
  @RequirePermission({ member: ['update'] })
  async setBranches(
    @CurrentBusiness() business: Business,
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberBranchesDto,
  ): Promise<MemberView> {
    return this.membersService.setBranches(business, memberId, dto);
  }
}

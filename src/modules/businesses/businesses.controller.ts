import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { Business } from '../../database/schema';
import { BusinessesService } from './businesses.service';
import { BusinessResponseDto } from './dto/business-response.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Controller({ path: 'businesses', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

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

    return {
      ...result,
      data: result.data.map((business) => new BusinessResponseDto(business)),
    };
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
}

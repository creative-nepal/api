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
  RequireSector,
  RequireSectorGuard,
} from '../../../../common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  Business,
  ServiceItem,
  ServiceMembership,
} from '../../../../database/schema';
import {
  CreateMembershipDto,
  CreateServiceItemDto,
  ListMembershipsQueryDto,
  ListServiceItemsQueryDto,
  UpdateServiceItemDto,
} from './dto/services.dto';
import { ServicesService } from './services.service';

@Controller({ path: 'businesses/:businessId/services', version: '1' })
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('services')
@UseInterceptors(ClassSerializerInterceptor)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @RequirePermission({ order: ['create'] })
  async listItems(
    @CurrentBusiness() business: Business,
    @Query() query: ListServiceItemsQueryDto,
  ): Promise<PaginatedResult<ServiceItem>> {
    return this.servicesService.listItems(business.id, query);
  }

  @Post()
  @RequirePermission({ membership: ['manage'] })
  async createItem(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateServiceItemDto,
  ): Promise<ServiceItem> {
    return this.servicesService.createItem(business.id, dto);
  }

  @Get('memberships')
  @RequirePermission({ membership: ['manage'] })
  async listMemberships(
    @CurrentBusiness() business: Business,
    @Query() query: ListMembershipsQueryDto,
  ): Promise<PaginatedResult<ServiceMembership>> {
    return this.servicesService.listMemberships(business.id, query);
  }

  @Post('memberships')
  @RequirePermission({ membership: ['manage'] })
  async createMembership(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateMembershipDto,
  ): Promise<ServiceMembership> {
    return this.servicesService.createMembership(business.id, dto);
  }

  @Get(':serviceItemId')
  @RequirePermission({ order: ['create'] })
  async getItem(
    @CurrentBusiness() business: Business,
    @Param('serviceItemId') serviceItemId: string,
  ): Promise<ServiceItem> {
    return this.servicesService.getItem(business.id, serviceItemId);
  }

  @Patch(':serviceItemId')
  @RequirePermission({ membership: ['manage'] })
  async updateItem(
    @CurrentBusiness() business: Business,
    @Param('serviceItemId') serviceItemId: string,
    @Body() dto: UpdateServiceItemDto,
  ): Promise<ServiceItem> {
    return this.servicesService.updateItem(business.id, serviceItemId, dto);
  }
}

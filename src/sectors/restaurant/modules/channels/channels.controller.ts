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
import type { Business, SalesChannel } from '../../../../database/schema';
import { ChannelsService } from './channels.service';
import {
  CreateChannelDto,
  ListChannelsQueryDto,
  UpdateChannelDto,
} from './dto/channel.dto';

@Controller({ path: 'businesses/:businessId/channels', version: '1' })
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @RequirePermission({ order: ['create'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListChannelsQueryDto,
  ): Promise<PaginatedResult<SalesChannel>> {
    return this.channelsService.list(business.id, query.limit, query.offset);
  }

  @Post()
  @RequirePermission({ business: ['manage'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateChannelDto,
  ): Promise<SalesChannel> {
    return this.channelsService.create(business.id, dto);
  }

  @Patch(':channelId')
  @RequirePermission({ business: ['manage'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ): Promise<SalesChannel> {
    return this.channelsService.update(business.id, channelId, dto);
  }
}

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
import type { Business } from '../../../../database/schema';
import {
  CreateHousekeepingTaskDto,
  HousekeepingTaskResponseDto,
  ListHousekeepingQueryDto,
  UpdateHousekeepingTaskDto,
} from './dto/housekeeping.dto';
import { HousekeepingService } from './housekeeping.service';

@Controller({ path: 'businesses/:businessId/housekeeping', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard, RequireSectorGuard)
@RequireSector('hotel')
@UseInterceptors(ClassSerializerInterceptor)
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get()
  @RequirePermission({ housekeeping: ['view'] })
  async list(
    @CurrentBusiness() business: Business,
    @Query() query: ListHousekeepingQueryDto,
  ): Promise<PaginatedResult<HousekeepingTaskResponseDto>> {
    const result = await this.housekeeping.list(business.id, query);

    return {
      ...result,
      data: result.data.map(
        (row) => new HousekeepingTaskResponseDto(row.task, row.roomNo),
      ),
    };
  }

  @Post()
  @RequirePermission({ housekeeping: ['update'] })
  async create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateHousekeepingTaskDto,
  ): Promise<HousekeepingTaskResponseDto> {
    return new HousekeepingTaskResponseDto(
      await this.housekeeping.create(business, dto),
    );
  }

  @Patch(':taskId')
  @RequirePermission({ housekeeping: ['update'] })
  async update(
    @CurrentBusiness() business: Business,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateHousekeepingTaskDto,
  ): Promise<HousekeepingTaskResponseDto> {
    return new HousekeepingTaskResponseDto(
      await this.housekeeping.update(business, taskId, dto),
    );
  }
}

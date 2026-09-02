import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
  RequireSector,
  RequireSectorGuard,
} from '../../common';
import type { Business } from '../../database/schema';
import {
  type RestaurantAnalytics,
  RestaurantAnalyticsService,
} from './restaurant-analytics.service';

class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  sinceDays: number = 30;
}

@Controller({
  path: 'businesses/:businessId/restaurant/analytics',
  version: '1',
})
@UseGuards(BusinessAccessGuard, RequireSectorGuard, RequirePermissionGuard)
@RequireSector('restaurant')
@UseInterceptors(ClassSerializerInterceptor)
export class RestaurantAnalyticsController {
  constructor(private readonly analyticsService: RestaurantAnalyticsService) {}

  @Get()
  @RequirePermission({ product: ['update'] })
  async get(
    @CurrentBusiness() business: Business,
    @Query() query: AnalyticsQueryDto,
  ): Promise<RestaurantAnalytics> {
    return this.analyticsService.getAnalytics(business.id, query.sinceDays);
  }
}

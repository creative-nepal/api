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
import { BusinessAccessGuard, CurrentBusiness } from '../../common';
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
@UseGuards(BusinessAccessGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class RestaurantAnalyticsController {
  constructor(private readonly analyticsService: RestaurantAnalyticsService) {}

  @Get()
  async get(
    @CurrentBusiness() business: Business,
    @Query() query: AnalyticsQueryDto,
  ): Promise<RestaurantAnalytics> {
    return this.analyticsService.getAnalytics(business.id, query.sinceDays);
  }
}

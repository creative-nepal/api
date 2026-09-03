import { Module } from '@nestjs/common';
import { RestaurantAnalyticsController } from './restaurant-analytics.controller';
import { RestaurantAnalyticsService } from './restaurant-analytics.service';

@Module({
  controllers: [RestaurantAnalyticsController],
  providers: [RestaurantAnalyticsService],
  exports: [RestaurantAnalyticsService],
})
export class RestaurantAnalyticsModule {}

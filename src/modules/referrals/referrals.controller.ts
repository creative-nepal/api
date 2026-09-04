import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
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
} from '../../common';
import type { Business } from '../../database/schema';
import {
  AttributeReferralDto,
  ReferralLeaderboardQueryDto,
} from './dto/referral.dto';
import { type ReferralSummary, ReferralsService } from './referrals.service';

@Controller({ path: 'businesses/:businessId', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('customers/:customerId/referral')
  async summary(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
  ): Promise<ReferralSummary> {
    return this.referralsService.summary(business, customerId);
  }

  @Post('customers/:customerId/referral')
  @RequirePermission({ order: ['create'] })
  async attribute(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Body() dto: AttributeReferralDto,
  ): Promise<ReferralSummary> {
    await this.referralsService.attribute(business.id, customerId, dto.code);

    return this.referralsService.summary(business, customerId);
  }

  @Get('referrals')
  @RequirePermission({ report: ['view'] })
  async leaderboard(
    @CurrentBusiness() business: Business,
    @Query() query: ReferralLeaderboardQueryDto,
  ) {
    return this.referralsService.leaderboard(
      business.id,
      query.limit,
      query.offset,
    );
  }
}

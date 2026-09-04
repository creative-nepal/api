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
import { CurrentUser, type CurrentUserType } from '../../auth';
import {
  BusinessAccessGuard,
  CurrentBusiness,
  RequirePermission,
  RequirePermissionGuard,
} from '../../common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type {
  Business,
  CustomerFeedback,
  LoyaltyEntry,
} from '../../database/schema';
import {
  AdjustPointsDto,
  ListLoyaltyQueryDto,
  RedeemPointsDto,
  SubmitFeedbackDto,
} from './dto/loyalty.dto';
import { type FeedbackSummary, LoyaltyService } from './loyalty.service';

@Controller({
  path: 'businesses/:businessId/customers/:customerId/loyalty',
  version: '1',
})
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get()
  @RequirePermission({ order: ['create'] })
  async ledger(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Query() query: ListLoyaltyQueryDto,
  ): Promise<PaginatedResult<LoyaltyEntry>> {
    return this.loyaltyService.ledger(
      business.id,
      customerId,
      query.limit,
      query.offset,
    );
  }

  @Post('redeem')
  @RequirePermission({ order: ['discount'] })
  async redeem(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Body() dto: RedeemPointsDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<{ entry: LoyaltyEntry; valueCents: number }> {
    return this.loyaltyService.redeem(
      business,
      customerId,
      dto,
      currentUser.id,
    );
  }

  @Post('adjust')
  @RequirePermission({ business: ['manage'] })
  async adjust(
    @CurrentBusiness() business: Business,
    @Param('customerId') customerId: string,
    @Body() dto: AdjustPointsDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<LoyaltyEntry> {
    return this.loyaltyService.adjust(
      business.id,
      customerId,
      dto,
      currentUser.id,
    );
  }
}

@Controller({ path: 'businesses/:businessId/feedback', version: '1' })
@UseGuards(BusinessAccessGuard, RequirePermissionGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class FeedbackController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('summary')
  @RequirePermission({ order: ['create'] })
  async summary(
    @CurrentBusiness() business: Business,
  ): Promise<FeedbackSummary> {
    return this.loyaltyService.feedbackSummary(business.id);
  }

  @Post('orders/:orderId')
  @RequirePermission({ order: ['create'] })
  async submit(
    @CurrentBusiness() business: Business,
    @Param('orderId') orderId: string,
    @Body() dto: SubmitFeedbackDto,
  ): Promise<CustomerFeedback> {
    return this.loyaltyService.submitFeedback(business.id, orderId, dto);
  }
}

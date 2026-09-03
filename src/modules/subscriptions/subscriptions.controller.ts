import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { BusinessAccessGuard } from '../../common';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller({ path: 'businesses/:businessId/subscriptions', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  @UseGuards(BusinessAccessGuard)
  async getCurrent(
    @Param('businessId') businessId: string,
  ): Promise<SubscriptionResponseDto> {
    const { subscription, plan } =
      await this.subscriptionsService.getCurrent(businessId);
    return new SubscriptionResponseDto(subscription, plan);
  }
}

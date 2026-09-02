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
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { BusinessAccessGuard } from '../../common';
import {
  type PaginatedResult,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import {
  AssignSubscriptionDto,
  CancelSubscriptionDto,
} from './dto/subscription-request.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { SubscriptionsService } from './subscriptions.service';

@Controller({ path: 'businesses/:businessId/subscriptions', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UserHasPermission({ permissions: { subscription: ['assign'] } })
  async assign(
    @Param('businessId') businessId: string,
    @Body() dto: AssignSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const { subscription, plan } = await this.subscriptionsService.assign(
      businessId,
      dto.planId,
      dto.trial ?? false,
    );
    return new SubscriptionResponseDto(subscription, plan);
  }

  @Get('current')
  @UseGuards(BusinessAccessGuard)
  async getCurrent(
    @Param('businessId') businessId: string,
  ): Promise<SubscriptionResponseDto> {
    const { subscription, plan } =
      await this.subscriptionsService.getCurrent(businessId);
    return new SubscriptionResponseDto(subscription, plan);
  }

  @Get()
  @UserHasPermission({ permissions: { subscription: ['view-any'] } })
  async listHistory(
    @Param('businessId') businessId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResult<SubscriptionResponseDto>> {
    const { rows, total } = await this.subscriptionsService.listHistory(
      businessId,
      query.limit,
      query.offset,
    );

    return {
      data: rows.map(
        (row) => new SubscriptionResponseDto(row.subscription, row.plan),
      ),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  @Patch('cancel')
  @UserHasPermission({ permissions: { subscription: ['cancel'] } })
  async cancel(
    @Param('businessId') businessId: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const { subscription, plan } = await this.subscriptionsService.cancel(
      businessId,
      dto.immediate ?? false,
    );
    return new SubscriptionResponseDto(subscription, plan);
  }
}

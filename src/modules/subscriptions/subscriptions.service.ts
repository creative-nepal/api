import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Plan, Subscription } from '../../database/schema';
import { BusinessesService } from '../businesses/businesses.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PlansService } from '../plans/plans.service';
import { billingPeriodEnd } from './billing-period';
import {
  SubscriptionsRepository,
  type SubscriptionWithPlan,
} from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly businessesService: BusinessesService,
    private readonly plansService: PlansService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getCurrent(businessId: string): Promise<SubscriptionWithPlan> {
    const found =
      await this.subscriptionsRepository.findLiveByBusinessId(businessId);

    if (!found) {
      throw new NotFoundException(
        `Business ${businessId} has no active subscription`,
      );
    }

    return found;
  }

  async listHistory(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<SubscriptionWithPlan[]> {
    return this.subscriptionsRepository.findManyByBusinessId(
      businessId,
      limit,
      offset,
    );
  }

  async assign(
    businessId: string,
    planId: string,
    trial: boolean,
  ): Promise<{ subscription: Subscription; plan: Plan }> {
    const business = await this.businessesService.getById(businessId);
    const plan = await this.plansService.getById(planId);

    if (plan.sector !== business.sector) {
      throw new BadRequestException(
        `Plan ${plan.key} is for sector ${plan.sector}, but business ${businessId} is ${business.sector}`,
      );
    }

    if (!plan.isActive) {
      throw new BadRequestException(`Plan ${plan.key} is archived`);
    }

    const now = new Date();
    const period = {
      currentPeriodStart: now,
      currentPeriodEnd: billingPeriodEnd(now, plan.billingCycle as never),
    };
    const status = trial ? 'trialing' : 'active';

    const existing =
      await this.subscriptionsRepository.findLiveByBusinessId(businessId);

    const subscription = existing
      ? await this.subscriptionsRepository.update(existing.subscription.id, {
          planId: plan.id,
          status,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          ...period,
        })
      : await this.subscriptionsRepository.insert({
          id: randomUUID(),
          businessId,
          planId: plan.id,
          status,
          cancelAtPeriodEnd: false,
          ...period,
        });

    if (!subscription) {
      throw new NotFoundException(
        `Subscription for business ${businessId} not found`,
      );
    }

    this.entitlementsService.invalidate(businessId);

    return { subscription, plan };
  }

  async cancel(
    businessId: string,
    immediate: boolean,
  ): Promise<SubscriptionWithPlan> {
    const current = await this.getCurrent(businessId);

    const updated = await this.subscriptionsRepository.update(
      current.subscription.id,
      immediate
        ? {
            status: 'canceled',
            cancelAtPeriodEnd: false,
            canceledAt: new Date(),
          }
        : { cancelAtPeriodEnd: true },
    );

    if (!updated) {
      throw new NotFoundException(
        `Subscription ${current.subscription.id} not found`,
      );
    }

    this.entitlementsService.invalidate(businessId);

    return { subscription: updated, plan: current.plan };
  }
}

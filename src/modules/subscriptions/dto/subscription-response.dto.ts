import { Exclude, Expose } from 'class-transformer';
import type { Plan, Subscription } from '../../../database/schema';

@Exclude()
export class SubscriptionResponseDto {
  @Expose() id: string;
  @Expose() businessId: string;
  @Expose() planId: string;
  @Expose() planKey: string | null;
  @Expose() planName: string | null;
  @Expose() priceCents: number | null;
  @Expose() currency: string | null;
  @Expose() billingCycle: string | null;
  @Expose() status: string;
  @Expose() currentPeriodStart: Date;
  @Expose() currentPeriodEnd: Date;
  @Expose() cancelAtPeriodEnd: boolean;
  @Expose() canceledAt: Date | null;

  constructor(subscription: Subscription, plan?: Plan) {
    this.id = subscription.id;
    this.businessId = subscription.businessId;
    this.planId = subscription.planId;
    this.planKey = plan?.key ?? null;
    this.planName = plan?.name ?? null;
    this.priceCents = plan?.priceCents ?? null;
    this.currency = plan?.currency ?? null;
    this.billingCycle = plan?.billingCycle ?? null;
    this.status = subscription.status;
    this.currentPeriodStart = subscription.currentPeriodStart;
    this.currentPeriodEnd = subscription.currentPeriodEnd;
    this.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    this.canceledAt = subscription.canceledAt;
  }
}

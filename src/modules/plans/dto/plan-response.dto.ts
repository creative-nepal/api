import { Exclude, Expose } from 'class-transformer';
import type { Plan, PlanFeatureFlags } from '../../../database/schema';

@Exclude()
export class PlanResponseDto {
  @Expose() id: string;
  @Expose() sector: string;
  @Expose() key: string;
  @Expose() name: string;
  @Expose() priceCents: number;
  @Expose() currency: string;
  @Expose() billingCycle: string;
  @Expose() featureFlags: PlanFeatureFlags;
  @Expose() isActive: boolean;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;

  constructor(plan: Plan) {
    this.id = plan.id;
    this.sector = plan.sector;
    this.key = plan.key;
    this.name = plan.name;
    this.priceCents = plan.priceCents;
    this.currency = plan.currency;
    this.billingCycle = plan.billingCycle;
    this.featureFlags = plan.featureFlags;
    this.isActive = plan.isActive;
    this.createdAt = plan.createdAt;
    this.updatedAt = plan.updatedAt;
  }
}

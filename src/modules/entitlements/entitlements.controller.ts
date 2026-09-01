import { Controller, Get, UseGuards } from '@nestjs/common';
import { BusinessAccessGuard, CurrentBusiness } from '../../common';
import type { Business, PlanFeatureFlags } from '../../database/schema';
import { EntitlementsService } from './entitlements.service';

interface EntitlementResponse {
  businessId: string;
  planKey: string | null;
  planName: string | null;
  status: string | null;
  currentPeriodEnd: Date | null;
  featureFlags: PlanFeatureFlags;
}

@Controller({ path: 'businesses/:businessId/entitlements', version: '1' })
@UseGuards(BusinessAccessGuard)
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get()
  async get(
    @CurrentBusiness() business: Business,
  ): Promise<EntitlementResponse> {
    const entitlement = await this.entitlementsService.getActiveEntitlement(
      business.id,
    );

    return {
      businessId: business.id,
      planKey: entitlement?.plan.key ?? null,
      planName: entitlement?.plan.name ?? null,
      status: entitlement?.subscription.status ?? null,
      currentPeriodEnd: entitlement?.subscription.currentPeriodEnd ?? null,
      featureFlags: entitlement?.featureFlags ?? {},
    };
  }
}

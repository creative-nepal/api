import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import { type Database, InjectDatabase, schema } from '../../database';
import { billingPeriodEnd } from '../subscriptions/billing-period';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PaymentGateway } from './gateway/payment-gateway.interface';
import {
  type DueSubscription,
  PlatformBillingRepository,
} from './platform-billing.repository';

const DUNNING_ATTEMPTS_BEFORE_SUSPEND = 3;

export interface BillingRunSummary {
  examined: number;
  charged: number;
  failed: number;
  skippedNoPaymentMethod: number;
  suspended: number;
}

@Injectable()
export class PlatformBillingService {
  constructor(
    private readonly logger: PinoLogger,
    @InjectDatabase() private readonly db: Database,
    private readonly repository: PlatformBillingRepository,
    private readonly gateway: PaymentGateway,
    private readonly entitlements: EntitlementsService,
  ) {
    this.logger.setContext(PlatformBillingService.name);
  }

  async runBilling(now: Date = new Date()): Promise<BillingRunSummary> {
    const due = await this.repository.findDue(now);

    const summary: BillingRunSummary = {
      examined: due.length,
      charged: 0,
      failed: 0,
      skippedNoPaymentMethod: 0,
      suspended: 0,
    };

    for (const entry of due) {
      try {
        await this.billOne(entry, now, summary);
      } catch (error) {
        this.logger.error(
          {
            err: error instanceof Error ? error : new Error(String(error)),
            subscriptionId: entry.subscription.id,
          },
          'Billing failed for subscription',
        );
        summary.failed += 1;
      }
    }

    return summary;
  }

  private async billOne(
    entry: DueSubscription,
    now: Date,
    summary: BillingRunSummary,
  ): Promise<void> {
    const { subscription, business, plan, ownerUserId } = entry;

    const paymentMethod =
      await this.repository.findDefaultPaymentMethod(ownerUserId);

    if (!paymentMethod) {
      await this.markPastDue(entry, 'No payment method on file');
      summary.skippedNoPaymentMethod += 1;
      return;
    }

    const result = await this.gateway.charge({
      amountCents: plan.priceCents,
      currency: plan.currency,
      gatewayToken: paymentMethod.gatewayToken,
      idempotencyKey: `${subscription.id}:${subscription.currentPeriodEnd.toISOString()}`,
      description: `${plan.name} — ${business.legalName}`,
    });

    const attemptNumber =
      (await this.repository.countFailedAttempts(subscription.id)) + 1;

    if (!result.success) {
      await this.db.transaction(async (tx) => {
        await this.repository.recordAttempt(tx, {
          id: randomUUID(),
          userId: ownerUserId,
          businessId: business.id,
          subscriptionId: subscription.id,
          paymentMethodId: paymentMethod.id,
          amountCents: plan.priceCents,
          provider: paymentMethod.provider,
          status: 'failed',
          failureReason: result.failureReason,
          attemptNumber,
        });

        await tx
          .update(schema.subscriptions)
          .set({ status: 'past_due' })
          .where(eq(schema.subscriptions.id, subscription.id));

        await this.repository.audit(tx, {
          id: randomUUID(),
          targetType: 'subscription',
          targetId: subscription.id,
          action: 'charge_failed',
          metadata: { attemptNumber, reason: result.failureReason },
        });

        if (attemptNumber >= DUNNING_ATTEMPTS_BEFORE_SUSPEND) {
          await tx
            .update(schema.businesses)
            .set({ status: 'suspended' })
            .where(eq(schema.businesses.id, business.id));

          await this.repository.audit(tx, {
            id: randomUUID(),
            targetType: 'business',
            targetId: business.id,
            action: 'suspended_for_non_payment',
            metadata: { attemptNumber },
          });

          summary.suspended += 1;
        }
      });

      this.entitlements.invalidate(business.id);
      summary.failed += 1;
      return;
    }

    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = billingPeriodEnd(periodStart, plan.billingCycle as never);
    const series = String(now.getUTCFullYear());

    await this.db.transaction(async (tx) => {
      await this.repository.recordAttempt(tx, {
        id: randomUUID(),
        userId: ownerUserId,
        businessId: business.id,
        subscriptionId: subscription.id,
        paymentMethodId: paymentMethod.id,
        amountCents: plan.priceCents,
        provider: paymentMethod.provider,
        status: 'succeeded',
        gatewayReference: result.reference,
        attemptNumber,
      });

      await tx
        .update(schema.subscriptions)
        .set({
          status: 'active',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        })
        .where(eq(schema.subscriptions.id, subscription.id));

      if (business.status === 'suspended') {
        await tx
          .update(schema.businesses)
          .set({ status: 'active' })
          .where(eq(schema.businesses.id, business.id));
      }

      const invoice = await this.repository.findOrCreateDraftInvoice(tx, {
        id: randomUUID(),
        userId: ownerUserId,
        series,
        periodStart,
        periodEnd,
        status: 'draft',
      });

      await this.repository.addLine(tx, {
        id: randomUUID(),
        platformInvoiceId: invoice.id,
        businessId: business.id,
        subscriptionId: subscription.id,
        planId: plan.id,
        description: `${plan.name} (${plan.billingCycle}) — ${business.legalName}`,
        periodStart,
        periodEnd,
        amountCents: plan.priceCents,
      });

      await this.repository.audit(tx, {
        id: randomUUID(),
        targetType: 'subscription',
        targetId: subscription.id,
        action: 'charged',
        metadata: {
          amountCents: plan.priceCents,
          reference: result.reference,
          periodEnd: periodEnd.toISOString(),
        },
      });
    });

    this.entitlements.invalidate(business.id);
    summary.charged += 1;
  }

  private async markPastDue(
    entry: DueSubscription,
    reason: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.subscriptions)
        .set({ status: 'past_due' })
        .where(eq(schema.subscriptions.id, entry.subscription.id));

      await this.repository.audit(tx, {
        id: randomUUID(),
        targetType: 'subscription',
        targetId: entry.subscription.id,
        action: 'past_due',
        metadata: { reason },
      });
    });

    this.entitlements.invalidate(entry.business.id);
  }

  async consolidate(now: Date = new Date()): Promise<number> {
    const series = String(now.getUTCFullYear());
    const drafts = await this.repository.findDraftInvoices(series);
    let closed = 0;

    for (const draft of drafts) {
      if (draft.totalCents <= 0) {
        continue;
      }

      await this.db.transaction(async (tx) => {
        const invoiceNumber = await this.repository.nextPlatformInvoiceNumber(
          tx,
          series,
        );

        await tx
          .update(schema.platformInvoices)
          .set({ invoiceNumber, status: 'open' })
          .where(eq(schema.platformInvoices.id, draft.id));

        await this.repository.audit(tx, {
          id: randomUUID(),
          targetType: 'platform_invoice',
          targetId: draft.id,
          action: 'issued',
          metadata: { series, invoiceNumber, totalCents: draft.totalCents },
        });
      });

      closed += 1;
    }

    return closed;
  }
}

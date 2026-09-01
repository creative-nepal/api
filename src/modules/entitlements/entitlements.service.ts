import {
  ForbiddenException,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { and, count, eq, gte } from 'drizzle-orm';
import { PinoLogger } from 'nestjs-pino';
import {
  type Database,
  getSqlClient,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Plan,
  PlanFeatureFlags,
  Subscription,
} from '../../database/schema';

export interface ActiveEntitlement {
  subscription: Subscription;
  plan: Plan;
  featureFlags: PlanFeatureFlags;
}

interface CacheEntry {
  value: ActiveEntitlement | null;
  expiresAt: number;
}

const INVALIDATION_CHANNEL = 'entitlements_invalidated';

@Injectable()
export class EntitlementsService implements OnModuleInit, OnModuleDestroy {
  private static readonly TTL_MS = 30_000;
  private static readonly RETRY_BASE_MS = 5_000;
  private static readonly RETRY_MAX_MS = 60_000;

  private readonly cache = new Map<string, CacheEntry>();
  private unlisten: (() => Promise<void>) | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private destroyed = false;

  constructor(
    private readonly logger: PinoLogger,
    @InjectDatabase() private readonly db: Database,
  ) {
    this.logger.setContext(EntitlementsService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.subscribeToInvalidation();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    await this.unlisten?.();
  }

  private async subscribeToInvalidation(): Promise<void> {
    try {
      const subscription = await getSqlClient().listen(
        INVALIDATION_CHANNEL,
        (payload) => {
          if (payload === '*') {
            this.cache.clear();
            return;
          }

          this.cache.delete(payload);
        },
      );

      this.unlisten = () => subscription.unlisten();

      if (this.retryAttempt > 0) {
        this.logger.info(
          { attempts: this.retryAttempt },
          `Subscribed to ${INVALIDATION_CHANNEL}; cache invalidation is cross-instance again`,
        );
      }

      this.retryAttempt = 0;
    } catch (error) {
      this.retryAttempt += 1;
      const delayMs = Math.min(
        EntitlementsService.RETRY_BASE_MS * 2 ** (this.retryAttempt - 1),
        EntitlementsService.RETRY_MAX_MS,
      );

      this.logger.warn(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          attempt: this.retryAttempt,
          delayMs,
        },
        `Could not subscribe to ${INVALIDATION_CHANNEL}; entitlement cache invalidation is instance-local until this recovers`,
      );

      if (this.destroyed) {
        return;
      }

      this.retryTimer = setTimeout(() => {
        void this.subscribeToInvalidation();
      }, delayMs).unref();
    }
  }

  async getActiveEntitlement(
    businessId: string,
  ): Promise<ActiveEntitlement | null> {
    const cached = this.cache.get(businessId);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const [row] = await this.db
      .select({
        subscription: schema.subscriptions,
        plan: schema.plans,
      })
      .from(schema.subscriptions)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
      .where(
        and(
          eq(schema.subscriptions.businessId, businessId),
          eq(schema.subscriptions.status, 'active'),
        ),
      )
      .limit(1);

    const value: ActiveEntitlement | null = row
      ? {
          subscription: row.subscription,
          plan: row.plan,
          featureFlags: row.plan.featureFlags ?? {},
        }
      : null;

    this.cache.set(businessId, {
      value,
      expiresAt: Date.now() + EntitlementsService.TTL_MS,
    });

    return value;
  }

  async hasFeature(businessId: string, key: string): Promise<boolean> {
    const entitlement = await this.getActiveEntitlement(businessId);
    return Boolean(entitlement?.featureFlags?.[key]);
  }

  async assertFeature(businessId: string, key: string): Promise<void> {
    if (!(await this.hasFeature(businessId, key))) {
      throw new ForbiddenException(
        `The current plan does not include "${key}"`,
      );
    }
  }

  async getLimit(businessId: string, key: string): Promise<number | undefined> {
    const entitlement = await this.getActiveEntitlement(businessId);
    const value = entitlement?.featureFlags?.[key];
    return typeof value === 'number' ? value : undefined;
  }

  async assertWithinLimit(
    businessId: string,
    key: string,
    current: number,
  ): Promise<void> {
    const limit = await this.getLimit(businessId, key);

    if (limit !== undefined && current >= limit) {
      throw new ForbiddenException(
        `The current plan allows at most ${limit} for "${key}"`,
      );
    }
  }

  async assertInvoiceQuotaAvailable(businessId: string): Promise<void> {
    const entitlement = await this.getActiveEntitlement(businessId);
    const limit = entitlement?.featureFlags?.maxInvoicesPerPeriod;

    if (!entitlement || typeof limit !== 'number' || limit <= 0) {
      return;
    }

    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          gte(
            schema.businessInvoices.createdAt,
            entitlement.subscription.currentPeriodStart,
          ),
        ),
      );

    if ((row?.value ?? 0) >= limit) {
      throw new ForbiddenException({
        message: 'i18n:errors.invoice.quotaExceeded',
        limit,
      });
    }
  }

  invalidate(businessId: string): void {
    this.cache.delete(businessId);
    this.broadcast(businessId);
  }

  invalidateAll(): void {
    this.cache.clear();
    this.broadcast('*');
  }

  private broadcast(payload: string): void {
    void getSqlClient()
      .notify(INVALIDATION_CHANNEL, payload)
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to broadcast entitlement invalidation for ${payload}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }
}

import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  NewSubscription,
  Plan,
  Subscription,
} from '../../database/schema';

export interface SubscriptionWithPlan {
  subscription: Subscription;
  plan: Plan;
}

@Injectable()
export class SubscriptionsRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findLiveByBusinessId(
    businessId: string,
  ): Promise<SubscriptionWithPlan | undefined> {
    const [row] = await this.db
      .select({ subscription: schema.subscriptions, plan: schema.plans })
      .from(schema.subscriptions)
      .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
      .where(
        and(
          eq(schema.subscriptions.businessId, businessId),
          ne(schema.subscriptions.status, 'canceled'),
        ),
      )
      .limit(1);
    return row;
  }

  async findManyByBusinessId(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: SubscriptionWithPlan[]; total: number }> {
    const where = eq(schema.subscriptions.businessId, businessId);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({ subscription: schema.subscriptions, plan: schema.plans })
        .from(schema.subscriptions)
        .innerJoin(
          schema.plans,
          eq(schema.plans.id, schema.subscriptions.planId),
        )
        .where(where)
        .orderBy(desc(schema.subscriptions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.subscriptions)
        .where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async insert(values: NewSubscription): Promise<Subscription> {
    const [row] = await this.db
      .insert(schema.subscriptions)
      .values(values)
      .returning();
    return row;
  }

  async update(
    id: string,
    patch: Partial<Omit<Subscription, 'id' | 'businessId' | 'createdAt'>>,
  ): Promise<Subscription | undefined> {
    const [row] = await this.db
      .update(schema.subscriptions)
      .set(patch)
      .where(eq(schema.subscriptions.id, id))
      .returning();
    return row;
  }
}

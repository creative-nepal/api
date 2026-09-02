import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, lte, ne, sql } from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Business,
  NewPaymentAttempt,
  NewPlatformInvoice,
  NewPlatformInvoiceLine,
  PaymentMethod,
  Plan,
  PlatformInvoice,
  Subscription,
} from '../../database/schema';

export interface DueSubscription {
  subscription: Subscription;
  business: Business;
  plan: Plan;
  ownerUserId: string;
}

@Injectable()
export class PlatformBillingRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findDue(now: Date): Promise<DueSubscription[]> {
    const rows = await this.db
      .select({
        subscription: schema.subscriptions,
        business: schema.businesses,
        plan: schema.plans,
        ownerUserId: schema.member.userId,
      })
      .from(schema.subscriptions)
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.subscriptions.businessId),
      )
      .innerJoin(schema.plans, eq(schema.plans.id, schema.subscriptions.planId))
      .innerJoin(
        schema.member,
        and(
          eq(schema.member.organizationId, schema.businesses.organizationId),
          eq(schema.member.role, 'owner'),
        ),
      )
      .where(
        and(
          ne(schema.subscriptions.status, 'canceled'),
          lte(schema.subscriptions.currentPeriodEnd, now),
        ),
      );

    return rows;
  }

  async findDefaultPaymentMethod(
    userId: string,
  ): Promise<PaymentMethod | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.paymentMethods)
      .where(
        and(
          eq(schema.paymentMethods.userId, userId),
          eq(schema.paymentMethods.isDefault, true),
          eq(schema.paymentMethods.status, 'active'),
        ),
      )
      .limit(1);
    return row;
  }

  async countFailedAttempts(subscriptionId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.paymentAttempts)
      .where(
        and(
          eq(schema.paymentAttempts.subscriptionId, subscriptionId),
          eq(schema.paymentAttempts.status, 'failed'),
        ),
      );
    return row?.value ?? 0;
  }

  async recordAttempt(
    executor: DatabaseExecutor,
    values: NewPaymentAttempt,
  ): Promise<void> {
    await executor.insert(schema.paymentAttempts).values(values);
  }

  async audit(
    executor: DatabaseExecutor,
    values: {
      id: string;
      actorUserId?: string | null;
      targetType: string;
      targetId: string;
      action: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await executor.insert(schema.platformAuditLog).values({
      ...values,
      actorUserId: values.actorUserId ?? null,
      metadata: values.metadata ?? {},
    });
  }

  async findOrCreateDraftInvoice(
    executor: DatabaseExecutor,
    values: NewPlatformInvoice,
  ): Promise<PlatformInvoice> {
    const [existing] = await executor
      .select()
      .from(schema.platformInvoices)
      .where(
        and(
          eq(schema.platformInvoices.userId, values.userId),
          eq(schema.platformInvoices.status, 'draft'),
          eq(schema.platformInvoices.series, values.series),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const [row] = await executor
      .insert(schema.platformInvoices)
      .values(values)
      .returning();
    return row;
  }

  async addLine(
    executor: DatabaseExecutor,
    values: NewPlatformInvoiceLine,
  ): Promise<void> {
    await executor.insert(schema.platformInvoiceLines).values(values);

    await executor
      .update(schema.platformInvoices)
      .set({
        subtotalCents: sql`${schema.platformInvoices.subtotalCents} + ${values.amountCents}`,
        totalCents: sql`${schema.platformInvoices.totalCents} + ${values.amountCents}`,
      })
      .where(eq(schema.platformInvoices.id, values.platformInvoiceId));
  }

  async nextPlatformInvoiceNumber(
    executor: DatabaseExecutor,
    series: string,
  ): Promise<number> {
    const [row] = await executor
      .insert(schema.platformInvoiceCounters)
      .values({ series, lastNumber: 1 })
      .onConflictDoUpdate({
        target: schema.platformInvoiceCounters.series,
        set: {
          lastNumber: sql`${schema.platformInvoiceCounters.lastNumber} + 1`,
        },
      })
      .returning({ lastNumber: schema.platformInvoiceCounters.lastNumber });

    return row.lastNumber;
  }

  async findDraftInvoices(series: string): Promise<PlatformInvoice[]> {
    return this.db
      .select()
      .from(schema.platformInvoices)
      .where(
        and(
          eq(schema.platformInvoices.status, 'draft'),
          eq(schema.platformInvoices.series, series),
        ),
      );
  }

  async findAllInvoices(
    limit: number,
    offset: number,
  ): Promise<Array<{ invoice: PlatformInvoice; accountEmail: string | null }>> {
    return this.db
      .select({
        invoice: schema.platformInvoices,
        accountEmail: schema.user.email,
      })
      .from(schema.platformInvoices)
      .leftJoin(schema.user, eq(schema.user.id, schema.platformInvoices.userId))
      .orderBy(desc(schema.platformInvoices.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countAllInvoices(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.platformInvoices);
    return row?.value ?? 0;
  }

  async invoiceTotals(): Promise<
    Record<string, { count: number; cents: number }>
  > {
    const rows = await this.db
      .select({
        status: schema.platformInvoices.status,
        count: count(),
        cents: sql<number>`COALESCE(SUM(${schema.platformInvoices.totalCents}), 0)`,
      })
      .from(schema.platformInvoices)
      .groupBy(schema.platformInvoices.status);

    return Object.fromEntries(
      rows.map((row) => [
        row.status,
        { count: Number(row.count), cents: Number(row.cents) },
      ]),
    );
  }

  async findInvoicesForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: PlatformInvoice[]; total: number }> {
    const where = eq(schema.platformInvoices.userId, userId);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.platformInvoices)
        .where(where)
        .orderBy(desc(schema.platformInvoices.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.platformInvoices)
        .where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }
}

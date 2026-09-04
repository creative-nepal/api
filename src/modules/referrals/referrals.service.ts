import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, eq, isNotNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Business,
  BusinessInvoice,
  Customer,
} from '../../database/schema';
import {
  generateReferralCode,
  isWellFormedReferralCode,
  normaliseReferralCode,
} from './referral-code';

export interface ReferralSummary {
  customerId: string;
  referralCode: string;
  referredByCustomerId: string | null;
  referredByName: string | null;
  referredCount: number;
  pointsEarned: number;
  rewardPoints: number;
  welcomePoints: number;
}

const CODE_ATTEMPTS = 10;

@Injectable()
export class ReferralsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async ensureCode(businessId: string, customerId: string): Promise<Customer> {
    const customer = await this.getCustomer(businessId, customerId);

    if (customer.referralCode) {
      return customer;
    }

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code = generateReferralCode();

      const [updated] = await this.db
        .update(schema.customers)
        .set({ referralCode: code })
        .where(
          and(
            eq(schema.customers.businessId, businessId),
            eq(schema.customers.id, customerId),
            sql`${schema.customers.referralCode} IS NULL`,
          ),
        )
        .returning()
        .catch(() => []);

      if (updated) {
        return updated;
      }

      const refreshed = await this.getCustomer(businessId, customerId);

      if (refreshed.referralCode) {
        return refreshed;
      }
    }

    throw new ConflictException('i18n:errors.referral.codeUnavailable');
  }

  async attribute(
    businessId: string,
    customerId: string,
    rawCode: string,
  ): Promise<Customer> {
    const code = normaliseReferralCode(rawCode);

    if (!isWellFormedReferralCode(code)) {
      throw new BadRequestException('i18n:errors.referral.malformedCode');
    }

    const customer = await this.getCustomer(businessId, customerId);

    if (customer.referredByCustomerId) {
      throw new ConflictException('i18n:errors.referral.alreadyAttributed');
    }

    const [referrer] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.referralCode, code),
        ),
      )
      .limit(1);

    if (!referrer) {
      throw new NotFoundException('i18n:errors.referral.unknownCode');
    }

    if (referrer.id === customerId) {
      throw new BadRequestException('i18n:errors.referral.selfReferral');
    }

    if (referrer.referredByCustomerId === customerId) {
      throw new BadRequestException('i18n:errors.referral.circular');
    }

    const invoices = await this.invoiceCount(businessId, customerId);

    if (invoices > 0) {
      throw new BadRequestException('i18n:errors.referral.notANewCustomer');
    }

    const [updated] = await this.db
      .update(schema.customers)
      .set({ referredByCustomerId: referrer.id })
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.id, customerId),
          sql`${schema.customers.referredByCustomerId} IS NULL`,
        ),
      )
      .returning();

    if (!updated) {
      throw new ConflictException('i18n:errors.referral.alreadyAttributed');
    }

    return updated;
  }

  async awardForInvoice(
    executor: DatabaseExecutor,
    business: Business,
    customer: Customer,
    invoice: BusinessInvoice,
  ): Promise<void> {
    if (!customer.referredByCustomerId) {
      return;
    }

    if (
      business.referralRewardPoints <= 0 &&
      business.referralWelcomePoints <= 0
    ) {
      return;
    }

    const [row] = await executor
      .select({ value: count() })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, business.id),
          eq(schema.businessInvoices.customerId, customer.id),
          eq(schema.businessInvoices.status, 'issued'),
        ),
      );

    if ((row?.value ?? 0) !== 1) {
      return;
    }

    if (business.referralRewardPoints > 0) {
      await this.credit(executor, {
        businessId: business.id,
        customerId: customer.referredByCustomerId,
        invoiceId: invoice.id,
        type: 'referral_earned',
        points: business.referralRewardPoints,
        note: `Referral reward for ${customer.name}`,
      });
    }

    if (business.referralWelcomePoints > 0) {
      await this.credit(executor, {
        businessId: business.id,
        customerId: customer.id,
        invoiceId: invoice.id,
        type: 'referral_welcome',
        points: business.referralWelcomePoints,
        note: 'Welcome bonus for joining through a referral',
      });
    }
  }

  async summary(
    business: Business,
    customerId: string,
  ): Promise<ReferralSummary> {
    const customer = await this.ensureCode(business.id, customerId);

    const [[referred], [earned], [referrer]] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.businessId, business.id),
            eq(schema.customers.referredByCustomerId, customerId),
          ),
        ),
      this.db
        .select({
          value: sql<string>`COALESCE(SUM(${schema.loyaltyLedger.points}), 0)`,
        })
        .from(schema.loyaltyLedger)
        .where(
          and(
            eq(schema.loyaltyLedger.businessId, business.id),
            eq(schema.loyaltyLedger.customerId, customerId),
            eq(schema.loyaltyLedger.type, 'referral_earned'),
          ),
        ),
      customer.referredByCustomerId
        ? this.db
            .select({ name: schema.customers.name })
            .from(schema.customers)
            .where(eq(schema.customers.id, customer.referredByCustomerId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return {
      customerId,
      referralCode: customer.referralCode ?? '',
      referredByCustomerId: customer.referredByCustomerId,
      referredByName: referrer?.name ?? null,
      referredCount: referred?.value ?? 0,
      pointsEarned: Number(earned?.value ?? 0),
      rewardPoints: business.referralRewardPoints,
      welcomePoints: business.referralWelcomePoints,
    };
  }

  async leaderboard(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<{
    data: Array<{
      customerId: string;
      name: string;
      referralCode: string | null;
      referredCount: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const referrer = alias(schema.customers, 'referrer');
    const referred = alias(schema.customers, 'referred');

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          customerId: referrer.id,
          name: referrer.name,
          referralCode: referrer.referralCode,
          referredCount: count(referred.id),
        })
        .from(referrer)
        .innerJoin(referred, eq(referred.referredByCustomerId, referrer.id))
        .where(eq(referrer.businessId, businessId))
        .groupBy(referrer.id, referrer.name, referrer.referralCode)
        .orderBy(sql`COUNT(${referred.id}) DESC`)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: sql<string>`COUNT(DISTINCT referred_by_customer_id)` })
        .from(schema.customers)
        .where(
          and(
            eq(schema.customers.businessId, businessId),
            isNotNull(schema.customers.referredByCustomerId),
          ),
        ),
    ]);

    return {
      data: rows.map((row) => ({
        customerId: row.customerId,
        name: row.name,
        referralCode: row.referralCode,
        referredCount: Number(row.referredCount),
      })),
      total: Number(total?.value ?? 0),
      limit,
      offset,
    };
  }

  private async credit(
    executor: DatabaseExecutor,
    params: {
      businessId: string;
      customerId: string;
      invoiceId: string;
      type: string;
      points: number;
      note: string;
    },
  ): Promise<void> {
    const [customer] = await executor
      .update(schema.customers)
      .set({
        loyaltyPoints: sql`${schema.customers.loyaltyPoints} + ${params.points}`,
      })
      .where(
        and(
          eq(schema.customers.businessId, params.businessId),
          eq(schema.customers.id, params.customerId),
        ),
      )
      .returning();

    if (!customer) {
      return;
    }

    await executor.insert(schema.loyaltyLedger).values({
      id: randomUUID(),
      businessId: params.businessId,
      customerId: params.customerId,
      invoiceId: params.invoiceId,
      type: params.type,
      points: params.points,
      balanceAfter: customer.loyaltyPoints,
      note: params.note,
      actorUserId: null,
    });
  }

  private async invoiceCount(
    businessId: string,
    customerId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.customerId, customerId),
        ),
      );

    return row?.value ?? 0;
  }

  private async getCustomer(
    businessId: string,
    customerId: string,
  ): Promise<Customer> {
    const [row] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.id, customerId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.customer.notFound',
        customerId,
      });
    }

    return row;
  }
}

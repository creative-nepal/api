import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, avg, count, desc, eq, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  Business,
  BusinessInvoice,
  CustomerFeedback,
  LoyaltyEntry,
} from '../../database/schema';
import type {
  AdjustPointsDto,
  RedeemPointsDto,
  SubmitFeedbackDto,
} from './dto/loyalty.dto';

export interface FeedbackSummary {
  averageRating: number | null;
  responses: number;
  distribution: Array<{ rating: number; responses: number }>;
}

@Injectable()
export class LoyaltyService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  pointsForSpend(business: Business, netCents: number): number {
    if (business.loyaltyPointsPerHundred <= 0) {
      return 0;
    }

    return Math.floor((netCents / 10_000) * business.loyaltyPointsPerHundred);
  }

  async awardForInvoice(
    executor: DatabaseExecutor,
    business: Business,
    customerId: string,
    invoice: BusinessInvoice,
  ): Promise<void> {
    const points = this.pointsForSpend(business, invoice.totalCents);

    if (points <= 0) {
      return;
    }

    await this.move(executor, {
      businessId: business.id,
      customerId,
      invoiceId: invoice.id,
      type: 'earned',
      points,
      note: null,
      actorUserId: null,
    });
  }

  async redeem(
    business: Business,
    customerId: string,
    dto: RedeemPointsDto,
    actorUserId: string,
  ): Promise<{ entry: LoyaltyEntry; valueCents: number }> {
    if (business.loyaltyPointValueCents <= 0) {
      throw new BadRequestException('i18n:errors.loyalty.notConfigured');
    }

    const entry = await this.db.transaction((tx) =>
      this.move(tx, {
        businessId: business.id,
        customerId,
        invoiceId: null,
        type: 'redeemed',
        points: -dto.points,
        note: dto.note ?? null,
        actorUserId,
      }),
    );

    return {
      entry,
      valueCents: dto.points * business.loyaltyPointValueCents,
    };
  }

  async adjust(
    businessId: string,
    customerId: string,
    dto: AdjustPointsDto,
    actorUserId: string,
  ): Promise<LoyaltyEntry> {
    if (dto.points === 0) {
      throw new BadRequestException('i18n:errors.loyalty.zeroAdjustment');
    }

    return this.db.transaction((tx) =>
      this.move(tx, {
        businessId,
        customerId,
        invoiceId: null,
        type: 'adjusted',
        points: dto.points,
        note: dto.note,
        actorUserId,
      }),
    );
  }

  async ledger(
    businessId: string,
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<LoyaltyEntry>> {
    const where = and(
      eq(schema.loyaltyLedger.businessId, businessId),
      eq(schema.loyaltyLedger.customerId, customerId),
    );

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.loyaltyLedger)
        .where(where)
        .orderBy(desc(schema.loyaltyLedger.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.loyaltyLedger)
        .where(where),
    ]);

    return { data, total: total?.value ?? 0, limit, offset };
  }

  async submitFeedback(
    businessId: string,
    orderId: string,
    dto: SubmitFeedbackDto,
  ): Promise<CustomerFeedback> {
    const [order] = await this.db
      .select()
      .from(schema.orders)
      .where(
        and(
          eq(schema.orders.businessId, businessId),
          eq(schema.orders.id, orderId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException({
        message: 'i18n:errors.loyalty.orderNotFound',
        orderId,
      });
    }

    try {
      const [row] = await this.db
        .insert(schema.customerFeedback)
        .values({
          id: randomUUID(),
          businessId,
          orderId,
          customerId: order.customerId,
          rating: dto.rating,
          comment: dto.comment ?? null,
        })
        .returning();

      return row;
    } catch {
      throw new ConflictException('i18n:errors.loyalty.feedbackExists');
    }
  }

  async feedbackSummary(businessId: string): Promise<FeedbackSummary> {
    const where = eq(schema.customerFeedback.businessId, businessId);

    const [[totals], distribution] = await Promise.all([
      this.db
        .select({
          averageRating: avg(schema.customerFeedback.rating),
          responses: count(),
        })
        .from(schema.customerFeedback)
        .where(where),
      this.db
        .select({
          rating: schema.customerFeedback.rating,
          responses: count(),
        })
        .from(schema.customerFeedback)
        .where(where)
        .groupBy(schema.customerFeedback.rating)
        .orderBy(schema.customerFeedback.rating),
    ]);

    return {
      averageRating:
        totals?.averageRating === null || totals?.averageRating === undefined
          ? null
          : Number(Number(totals.averageRating).toFixed(2)),
      responses: totals?.responses ?? 0,
      distribution: distribution.map((row) => ({
        rating: row.rating,
        responses: row.responses,
      })),
    };
  }

  private async move(
    executor: DatabaseExecutor,
    params: {
      businessId: string;
      customerId: string;
      invoiceId: string | null;
      type: string;
      points: number;
      note: string | null;
      actorUserId: string | null;
    },
  ): Promise<LoyaltyEntry> {
    const [customer] = await executor
      .update(schema.customers)
      .set({
        loyaltyPoints: sql`${schema.customers.loyaltyPoints} + ${params.points}`,
      })
      .where(
        and(
          eq(schema.customers.businessId, params.businessId),
          eq(schema.customers.id, params.customerId),
          sql`${schema.customers.loyaltyPoints} + ${params.points} >= 0`,
        ),
      )
      .returning();

    if (!customer) {
      throw new ConflictException('i18n:errors.loyalty.insufficientPoints');
    }

    const [entry] = await executor
      .insert(schema.loyaltyLedger)
      .values({
        id: randomUUID(),
        businessId: params.businessId,
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        type: params.type,
        points: params.points,
        balanceAfter: customer.loyaltyPoints,
        note: params.note,
        actorUserId: params.actorUserId,
      })
      .returning();

    return entry;
  }
}

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type {
  InsuranceClaim,
  InsuranceClaimStatus,
} from '../../../../database/schema';

const ALLOWED: Record<string, InsuranceClaimStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'rejected'],
  approved: [],
  rejected: [],
};

export interface TransitionInput {
  status: InsuranceClaimStatus;
  settledAmountCents?: number;
  reference?: string;
  reason?: string;
}

@Injectable()
export class ClaimsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async getById(businessId: string, claimId: string): Promise<InsuranceClaim> {
    const [row] = await this.db
      .select()
      .from(schema.insuranceClaims)
      .where(
        and(
          eq(schema.insuranceClaims.businessId, businessId),
          eq(schema.insuranceClaims.id, claimId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.claim.notFound',
        claimId,
      });
    }

    return row;
  }

  async transition(
    businessId: string,
    claimId: string,
    input: TransitionInput,
    actorUserId: string | null,
  ): Promise<InsuranceClaim> {
    const claim = await this.getById(businessId, claimId);
    const allowed = ALLOWED[claim.status] ?? [];

    if (!allowed.includes(input.status)) {
      throw new BadRequestException({
        message: 'i18n:errors.claim.badTransition',
        from: `i18n:common.claimStatus.${claim.status}`,
        to: `i18n:common.claimStatus.${input.status}`,
      });
    }

    if (input.status === 'approved') {
      const settled = input.settledAmountCents;

      if (settled === undefined) {
        throw new BadRequestException('i18n:errors.claim.settledRequired');
      }

      if (settled > claim.claimedAmountCents) {
        throw new BadRequestException({
          message: 'i18n:errors.claim.settledExceedsClaim',
          claimed: claim.claimedAmountCents,
          settled,
        });
      }
    }

    if (input.status === 'rejected' && !input.reason?.trim()) {
      throw new BadRequestException('i18n:errors.claim.reasonRequired');
    }

    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.insuranceClaims)
        .set({
          status: input.status,
          ...(input.reference ? { reference: input.reference } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.status === 'submitted' ? { submittedAt: now } : {}),
          ...(input.status === 'approved'
            ? { settledAmountCents: input.settledAmountCents, settledAt: now }
            : {}),
          ...(input.status === 'rejected' ? { settledAt: now } : {}),
        })
        .where(eq(schema.insuranceClaims.id, claimId))
        .returning();

      await tx.insert(schema.claimAuditLog).values({
        id: randomUUID(),
        businessId,
        claimId,
        fromStatus: claim.status,
        toStatus: input.status,
        note: input.reason ?? input.reference ?? null,
        actorUserId,
      });

      return updated;
    });
  }

  async history(businessId: string, claimId: string) {
    await this.getById(businessId, claimId);

    return this.db
      .select()
      .from(schema.claimAuditLog)
      .where(
        and(
          eq(schema.claimAuditLog.businessId, businessId),
          eq(schema.claimAuditLog.claimId, claimId),
        ),
      );
  }
}

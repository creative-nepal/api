import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { PaymentMethod } from '../../database/schema';
import type { AddPaymentMethodDto } from './dto/platform-billing.dto';
import { PlatformBillingRepository } from './platform-billing.repository';

@Injectable()
export class PaymentMethodsService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly repository: PlatformBillingRepository,
  ) {}

  async list(userId: string): Promise<PaymentMethod[]> {
    return this.db
      .select()
      .from(schema.paymentMethods)
      .where(
        and(
          eq(schema.paymentMethods.userId, userId),
          eq(schema.paymentMethods.status, 'active'),
        ),
      );
  }

  async add(userId: string, dto: AddPaymentMethodDto): Promise<PaymentMethod> {
    return this.db.transaction(async (tx) => {
      const existing = await this.repository.findDefaultPaymentMethod(userId);
      const makeDefault = dto.isDefault ?? !existing;

      if (makeDefault && existing) {
        await tx
          .update(schema.paymentMethods)
          .set({ isDefault: false })
          .where(eq(schema.paymentMethods.id, existing.id));
      }

      const [row] = await tx
        .insert(schema.paymentMethods)
        .values({
          id: randomUUID(),
          userId,
          provider: dto.provider,
          gatewayToken: dto.gatewayToken,
          displayLabel: dto.displayLabel,
          isDefault: makeDefault,
          status: 'active',
        })
        .returning();

      await this.repository.audit(tx, {
        id: randomUUID(),
        actorUserId: userId,
        targetType: 'payment_method',
        targetId: row.id,
        action: 'added',
        metadata: { provider: dto.provider, isDefault: makeDefault },
      });

      return row;
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .update(schema.paymentMethods)
      .set({ status: 'removed', isDefault: false })
      .where(
        and(
          eq(schema.paymentMethods.userId, userId),
          eq(schema.paymentMethods.id, id),
        ),
      )
      .returning();

    if (!row) {
      throw new NotFoundException(`Payment method ${id} not found`);
    }

    await this.repository.audit(this.db, {
      id: randomUUID(),
      actorUserId: userId,
      targetType: 'payment_method',
      targetId: id,
      action: 'removed',
    });
  }
}

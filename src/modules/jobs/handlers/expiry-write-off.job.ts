import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import { NotificationsService } from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

/**
 * Writes off batches whose expiry date has passed. Expired stock is not
 * sellable, so leaving it on hand overstates both inventory and its value;
 * the ledger entry is what makes the loss auditable rather than a silent
 * adjustment.
 */
@Injectable()
export class ExpiryWriteOffJob {
  static readonly NAME = 'expiry-write-off';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const expired = await this.db
      .select({
        id: schema.productBatches.id,
        businessId: schema.productBatches.businessId,
        productId: schema.productBatches.productId,
        batchNo: schema.productBatches.batchNo,
        qty: schema.productBatches.qty,
        productName: schema.products.name,
      })
      .from(schema.productBatches)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.productBatches.productId),
      )
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.productBatches.businessId),
      )
      .where(
        and(
          eq(schema.businesses.status, 'active'),
          eq(schema.productBatches.isActive, true),
          gt(schema.productBatches.qty, '0'),
          sql`${schema.productBatches.expiryDate} < current_date`,
        ),
      );

    const byBusiness = new Map<string, string[]>();

    for (const batch of expired) {
      await this.db.transaction(async (tx) => {
        await tx
          .update(schema.productBatches)
          .set({ qty: '0', isActive: false })
          .where(eq(schema.productBatches.id, batch.id));

        await tx
          .update(schema.products)
          .set({
            stockQty: sql`greatest(${schema.products.stockQty} - ${batch.qty}::numeric, 0)`,
          })
          .where(eq(schema.products.id, batch.productId));

        await tx.insert(schema.stockAdjustments).values({
          id: randomUUID(),
          businessId: batch.businessId,
          branchId: null,
          productId: batch.productId,
          batchId: batch.id,
          delta: `-${batch.qty}`,
          reason: 'expired_write_off',
          note: `Batch ${batch.batchNo} expired`,
          actorUserId: null,
        });
      });

      const bucket = byBusiness.get(batch.businessId) ?? [];
      bucket.push(`${batch.productName} (${batch.batchNo})`);
      byBusiness.set(batch.businessId, bucket);
    }

    const day = new Date().toISOString().slice(0, 10);

    for (const [businessId, items] of byBusiness) {
      await this.notifications.raise({
        businessId,
        type: 'batch.writtenOff',
        severity: 'warning',
        titleKey: 'ui.web.notifications.writtenOffTitle',
        bodyKey: 'ui.web.notifications.writtenOffBody',
        params: { count: items.length, items: items.slice(0, 5).join(', ') },
        href: '/batches',
        dedupeKey: `batch.writtenOff:${day}`,
      });
    }

    return { writtenOff: expired.length, businesses: byBusiness.size };
  }
}

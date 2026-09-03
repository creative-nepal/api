import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, ProductBatch } from '../../../../database/schema';
import { StockAdjustmentsService } from '../../../../modules/stock-adjustments/stock-adjustments.service';

export interface RecallDispense {
  orderId: string;
  invoiceId: string | null;
  invoiceNumber: number | null;
  soldAt: Date;
  quantity: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
}

export interface RecallReport {
  batch: ProductBatch;
  productName: string;
  remainingQty: number;
  dispensedQty: number;
  dispenses: RecallDispense[];
}

@Injectable()
export class RecallService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly stockAdjustments: StockAdjustmentsService,
  ) {}

  async report(businessId: string, batchId: string): Promise<RecallReport> {
    const batch = await this.requireBatch(businessId, batchId);

    const [product] = await this.db
      .select({ name: schema.products.name })
      .from(schema.products)
      .where(eq(schema.products.id, batch.productId))
      .limit(1);

    const rows = await this.db
      .select({
        orderId: schema.orderItems.orderId,
        quantity: schema.orderItems.quantity,
        soldAt: schema.orders.createdAt,
        invoiceId: schema.businessInvoices.id,
        invoiceNumber: schema.businessInvoices.invoiceNumber,
        customerId: schema.customers.id,
        customerName: schema.customers.name,
        customerPhone: schema.customers.phone,
        customerEmail: schema.customers.email,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .leftJoin(
        schema.businessInvoices,
        eq(schema.businessInvoices.orderId, schema.orders.id),
      )
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.orders.customerId),
      )
      .where(
        and(
          eq(schema.orderItems.businessId, businessId),
          eq(schema.orderItems.batchId, batchId),
        ),
      )
      .orderBy(desc(schema.orders.createdAt));

    const dispenses = rows.map((row) => ({
      orderId: row.orderId,
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoiceNumber,
      soldAt: row.soldAt,
      quantity: Number(row.quantity),
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
    }));

    return {
      batch,
      productName: product?.name ?? '',
      remainingQty: Number(batch.qty),
      dispensedQty: dispenses.reduce(
        (total, dispense) => total + dispense.quantity,
        0,
      ),
      dispenses,
    };
  }

  async quarantine(
    business: Business,
    branchId: string,
    batchId: string,
    actorUserId: string,
    note?: string,
  ): Promise<RecallReport> {
    const batch = await this.requireBatch(business.id, batchId);
    const remaining = Number(batch.qty);

    if (remaining > 0) {
      await this.stockAdjustments.create(
        business,
        branchId,
        {
          productId: batch.productId,
          batchId: batch.id,
          delta: -remaining,
          reason: 'recalled',
          note: note ?? `Recall of batch ${batch.batchNo}`,
        },
        actorUserId,
      );
    }

    await this.db
      .update(schema.productBatches)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.productBatches.businessId, business.id),
          eq(schema.productBatches.id, batchId),
        ),
      );

    return this.report(business.id, batchId);
  }

  private async requireBatch(
    businessId: string,
    batchId: string,
  ): Promise<ProductBatch> {
    const [batch] = await this.db
      .select()
      .from(schema.productBatches)
      .where(
        and(
          eq(schema.productBatches.businessId, businessId),
          eq(schema.productBatches.id, batchId),
        ),
      )
      .limit(1);

    if (!batch) {
      throw new NotFoundException({
        message: 'i18n:errors.stock.batchNotFound',
        batchId,
      });
    }

    return batch;
  }
}

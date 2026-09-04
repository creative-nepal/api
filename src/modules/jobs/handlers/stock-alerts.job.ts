import { Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../../database';
import {
  NotificationsService,
  type RaiseNotification,
} from '../../notifications/notifications.service';
import type { JobDetail } from '../job-runner.service';

const EXPIRY_WINDOW_DAYS = 30;

@Injectable()
export class StockAlertsJob {
  static readonly NAME = 'stock-alerts';

  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  async run(): Promise<JobDetail> {
    const lowStock = await this.db
      .select({
        businessId: schema.products.businessId,
        productId: schema.products.id,
        name: schema.products.name,
        stockQty: schema.products.stockQty,
        threshold: schema.products.lowStockThreshold,
      })
      .from(schema.products)
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.products.businessId),
      )
      .leftJoin(
        schema.businessSettings,
        eq(schema.businessSettings.businessId, schema.businesses.id),
      )
      .where(
        and(
          eq(schema.products.isActive, true),
          eq(schema.businesses.status, 'active'),
          or(
            isNull(schema.businessSettings.businessId),
            eq(schema.businessSettings.lowStockAlertsEnabled, true),
          ),
          gt(schema.products.lowStockThreshold, '0'),
          lte(schema.products.stockQty, schema.products.lowStockThreshold),
        ),
      );

    const expiring = await this.db
      .select({
        businessId: schema.productBatches.businessId,
        batchId: schema.productBatches.id,
        batchNo: schema.productBatches.batchNo,
        expiryDate: schema.productBatches.expiryDate,
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
      .leftJoin(
        schema.businessSettings,
        eq(schema.businessSettings.businessId, schema.businesses.id),
      )
      .where(
        and(
          eq(schema.businesses.status, 'active'),
          or(
            isNull(schema.businessSettings.businessId),
            eq(schema.businessSettings.expiryAlertsEnabled, true),
          ),
          gt(schema.productBatches.qty, '0'),
          eq(schema.productBatches.isActive, true),
          sql`${schema.productBatches.expiryDate} <= current_date + make_interval(days => ${EXPIRY_WINDOW_DAYS})`,
        ),
      );

    const raises: RaiseNotification[] = [
      ...lowStock.map((row) => ({
        businessId: row.businessId,
        type: 'stock.low',
        severity: 'warning' as const,
        titleKey: 'ui.web.notifications.lowStockTitle',
        bodyKey: 'ui.web.notifications.lowStockBody',
        params: { product: row.name, stock: row.stockQty },
        href: '/products',
        dedupeKey: `stock.low:${row.productId}`,
      })),
      ...expiring.map((row) => ({
        businessId: row.businessId,
        type: 'batch.expiring',
        severity: 'warning' as const,
        titleKey: 'ui.web.notifications.expiringTitle',
        bodyKey: 'ui.web.notifications.expiringBody',
        params: {
          product: row.productName,
          batch: row.batchNo,
          date: row.expiryDate,
        },
        href: '/batches',
        dedupeKey: `batch.expiring:${row.batchId}`,
      })),
    ];

    const raised = await this.notifications.raiseMany(raises);

    return {
      lowStock: lowStock.length,
      expiring: expiring.length,
      raised,
    };
  }
}

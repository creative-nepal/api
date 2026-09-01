import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';

export interface CountByKey {
  key: string;
  value: number;
}

export interface PlatformAuditLogRow {
  id: string;
  invoiceId: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  invoiceNumber: number;
  fiscalYear: string;
}

@Injectable()
export class PlatformRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async countBusinessesByStatus(): Promise<CountByKey[]> {
    const rows = await this.db
      .select({ key: schema.businesses.status, value: count() })
      .from(schema.businesses)
      .groupBy(schema.businesses.status);
    return rows;
  }

  async countBusinessesBySector(): Promise<CountByKey[]> {
    const rows = await this.db
      .select({ key: schema.businesses.sector, value: count() })
      .from(schema.businesses)
      .groupBy(schema.businesses.sector);
    return rows;
  }

  async countSubscriptionsByStatus(): Promise<CountByKey[]> {
    const rows = await this.db
      .select({ key: schema.subscriptions.status, value: count() })
      .from(schema.subscriptions)
      .groupBy(schema.subscriptions.status);
    return rows;
  }

  async countCbmsQueueByStatus(): Promise<CountByKey[]> {
    const rows = await this.db
      .select({ key: schema.cbmsPushQueue.status, value: count() })
      .from(schema.cbmsPushQueue)
      .innerJoin(
        schema.businesses,
        eq(schema.businesses.id, schema.cbmsPushQueue.businessId),
      )
      .where(
        and(
          eq(schema.businesses.cbmsRequired, true),
          inArray(schema.cbmsPushQueue.status, ['pending', 'failed']),
        ),
      )
      .groupBy(schema.cbmsPushQueue.status);
    return rows;
  }

  async findAuditLog(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<PlatformAuditLogRow[]> {
    return this.db
      .select({
        id: schema.invoiceAuditLog.id,
        invoiceId: schema.invoiceAuditLog.invoiceId,
        action: schema.invoiceAuditLog.action,
        actorUserId: schema.invoiceAuditLog.actorUserId,
        actorName: schema.user.name,
        metadata: schema.invoiceAuditLog.metadata,
        createdAt: schema.invoiceAuditLog.createdAt,
        invoiceNumber: schema.businessInvoices.invoiceNumber,
        fiscalYear: schema.businessInvoices.fiscalYear,
      })
      .from(schema.invoiceAuditLog)
      .innerJoin(
        schema.businessInvoices,
        eq(schema.businessInvoices.id, schema.invoiceAuditLog.invoiceId),
      )
      .leftJoin(
        schema.user,
        eq(schema.user.id, schema.invoiceAuditLog.actorUserId),
      )
      .where(eq(schema.invoiceAuditLog.businessId, businessId))
      .orderBy(desc(schema.invoiceAuditLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async countAuditLog(businessId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.invoiceAuditLog)
      .where(eq(schema.invoiceAuditLog.businessId, businessId));
    return row?.value ?? 0;
  }

  async findRecentBusinesses(limit: number): Promise<Business[]> {
    return this.db
      .select()
      .from(schema.businesses)
      .orderBy(desc(schema.businesses.createdAt))
      .limit(limit);
  }
}

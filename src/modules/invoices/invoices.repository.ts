import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  type SQL,
  sql,
} from 'drizzle-orm';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type {
  BusinessInvoice,
  InvoiceAuditAction,
  InvoiceAuditLogRow,
  NewBusinessInvoice,
} from '../../database/schema';

export interface ListInvoicesFilters {
  businessId: string;
  branchId?: string;
  limit: number;
  offset: number;
  fiscalYear?: string;
  status?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class InvoicesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async nextInvoiceNumber(
    executor: DatabaseExecutor,
    businessId: string,
    branchId: string,
    fiscalYear: string,
  ): Promise<number> {
    const [row] = await executor
      .insert(schema.invoiceCounters)
      .values({ businessId, branchId, fiscalYear, lastNumber: 1 })
      .onConflictDoUpdate({
        target: [
          schema.invoiceCounters.businessId,
          schema.invoiceCounters.branchId,
          schema.invoiceCounters.fiscalYear,
        ],
        set: {
          lastNumber: sql`${schema.invoiceCounters.lastNumber} + 1`,
        },
      })
      .returning({ lastNumber: schema.invoiceCounters.lastNumber });

    return row.lastNumber;
  }

  async insertInvoice(
    executor: DatabaseExecutor,
    values: NewBusinessInvoice,
  ): Promise<BusinessInvoice> {
    const [row] = await executor
      .insert(schema.businessInvoices)
      .values(values)
      .returning();
    return row;
  }

  async appendAuditLog(
    executor: DatabaseExecutor,
    values: {
      id: string;
      businessId: string;
      invoiceId: string;
      action: InvoiceAuditAction;
      actorUserId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await executor.insert(schema.invoiceAuditLog).values({
      ...values,
      metadata: values.metadata ?? {},
    });
  }

  async enqueueCbmsPush(
    executor: DatabaseExecutor,
    values: { id: string; businessId: string; invoiceId: string },
  ): Promise<void> {
    await executor.insert(schema.cbmsPushQueue).values(values);
  }

  async findById(
    businessId: string,
    id: string,
  ): Promise<BusinessInvoice | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findMany(filters: ListInvoicesFilters): Promise<BusinessInvoice[]> {
    return this.db
      .select()
      .from(schema.businessInvoices)
      .where(this.buildWhere(filters))
      .orderBy(desc(schema.businessInvoices.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countMany(filters: ListInvoicesFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businessInvoices)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findAllForFiscalYear(
    businessId: string,
    fiscalYear: string,
    branchId?: string,
  ): Promise<BusinessInvoice[]> {
    return this.db
      .select()
      .from(schema.businessInvoices)
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.fiscalYear, fiscalYear),
          ...(branchId ? [eq(schema.businessInvoices.branchId, branchId)] : []),
        ),
      )
      .orderBy(asc(schema.businessInvoices.invoiceNumber));
  }

  async incrementPrintedCount(
    businessId: string,
    id: string,
  ): Promise<BusinessInvoice | undefined> {
    const [row] = await this.db
      .update(schema.businessInvoices)
      .set({
        printedCount: sql`${schema.businessInvoices.printedCount} + 1`,
      })
      .where(
        and(
          eq(schema.businessInvoices.businessId, businessId),
          eq(schema.businessInvoices.id, id),
        ),
      )
      .returning();
    return row;
  }

  async findAuditLog(
    businessId: string,
    invoiceId: string,
  ): Promise<InvoiceAuditLogRow[]> {
    return this.db
      .select()
      .from(schema.invoiceAuditLog)
      .where(
        and(
          eq(schema.invoiceAuditLog.businessId, businessId),
          eq(schema.invoiceAuditLog.invoiceId, invoiceId),
        ),
      )
      .orderBy(asc(schema.invoiceAuditLog.createdAt));
  }

  private buildWhere(filters: ListInvoicesFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.businessInvoices.businessId, filters.businessId),
    ];

    if (filters.branchId) {
      conditions.push(eq(schema.businessInvoices.branchId, filters.branchId));
    }

    if (filters.fiscalYear) {
      conditions.push(
        eq(schema.businessInvoices.fiscalYear, filters.fiscalYear),
      );
    }

    if (filters.status) {
      conditions.push(eq(schema.businessInvoices.status, filters.status));
    }

    if (filters.from) {
      conditions.push(gte(schema.businessInvoices.createdAt, filters.from));
    }

    if (filters.to) {
      conditions.push(lte(schema.businessInvoices.createdAt, filters.to));
    }

    return and(...conditions);
  }
}

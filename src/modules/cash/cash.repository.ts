import { Injectable } from '@nestjs/common';
import { and, count, eq, type SQL, sql, sum } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import { resolveOrderBy } from '../../common/repository/sorting';
import type {
  CashMovement,
  CashSession,
  CashSessionStatus,
  InvoicePayment,
  NewCashMovement,
  NewCashSession,
  NewInvoicePayment,
} from '../../database/schema';

const SORTABLE = {
  openedAt: schema.cashSessions.openedAt,
  closedAt: schema.cashSessions.closedAt,
  status: schema.cashSessions.status,
  varianceCents: schema.cashSessions.varianceCents,
};

export interface ListCashSessionsFilters {
  businessId: string;
  branchId?: string;
  status?: CashSessionStatus;
  limit: number;
  offset: number;
  sortBy?: string;
  sortDirection: SortDirection;
}

export interface MethodTotal {
  method: string;
  amountCents: number;
  count: number;
}

@Injectable()
export class CashRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async insertSession(values: NewCashSession): Promise<CashSession> {
    const [row] = await this.db
      .insert(schema.cashSessions)
      .values(values)
      .returning();
    return row;
  }

  async findSessionById(
    businessId: string,
    id: string,
  ): Promise<CashSession | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.cashSessions)
      .where(
        and(
          eq(schema.cashSessions.businessId, businessId),
          eq(schema.cashSessions.id, id),
        ),
      )
      .limit(1);
    return row;
  }

  async findOpenSession(
    businessId: string,
    branchId: string,
  ): Promise<CashSession | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.cashSessions)
      .where(
        and(
          eq(schema.cashSessions.businessId, businessId),
          eq(schema.cashSessions.branchId, branchId),
          eq(schema.cashSessions.status, 'open'),
        ),
      )
      .limit(1);
    return row;
  }

  async findManySessions(
    filters: ListCashSessionsFilters,
  ): Promise<CashSession[]> {
    return this.db
      .select()
      .from(schema.cashSessions)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.cashSessions.openedAt,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);
  }

  async countSessions(filters: ListCashSessionsFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.cashSessions)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async closeSession(
    businessId: string,
    id: string,
    patch: {
      countedCashCents: number;
      expectedCashCents: number;
      varianceCents: number;
      closedByUserId: string;
      note: string | null;
    },
  ): Promise<CashSession | undefined> {
    const [row] = await this.db
      .update(schema.cashSessions)
      .set({
        status: 'closed',
        closedAt: new Date(),
        countedCashCents: patch.countedCashCents,
        expectedCashCents: patch.expectedCashCents,
        varianceCents: patch.varianceCents,
        closedByUserId: patch.closedByUserId,
        ...(patch.note === null ? {} : { note: patch.note }),
      })
      .where(
        and(
          eq(schema.cashSessions.businessId, businessId),
          eq(schema.cashSessions.id, id),
          eq(schema.cashSessions.status, 'open'),
        ),
      )
      .returning();
    return row;
  }

  async insertPayments(
    executor: DatabaseExecutor,
    values: NewInvoicePayment[],
  ): Promise<InvoicePayment[]> {
    if (values.length === 0) {
      return [];
    }

    return executor.insert(schema.invoicePayments).values(values).returning();
  }

  async findPaymentsForInvoice(
    businessId: string,
    invoiceId: string,
  ): Promise<InvoicePayment[]> {
    return this.db
      .select()
      .from(schema.invoicePayments)
      .where(
        and(
          eq(schema.invoicePayments.businessId, businessId),
          eq(schema.invoicePayments.invoiceId, invoiceId),
        ),
      );
  }

  async paidTotalForInvoice(
    executor: DatabaseExecutor,
    businessId: string,
    invoiceId: string,
  ): Promise<number> {
    const [row] = await executor
      .select({ value: sum(schema.invoicePayments.amountCents) })
      .from(schema.invoicePayments)
      .where(
        and(
          eq(schema.invoicePayments.businessId, businessId),
          eq(schema.invoicePayments.invoiceId, invoiceId),
        ),
      );
    return Number(row?.value ?? 0);
  }

  async methodTotalsForSession(sessionId: string): Promise<MethodTotal[]> {
    const rows = await this.db
      .select({
        method: schema.invoicePayments.method,
        amountCents: sum(schema.invoicePayments.amountCents),
        count: count(),
      })
      .from(schema.invoicePayments)
      .where(eq(schema.invoicePayments.cashSessionId, sessionId))
      .groupBy(schema.invoicePayments.method);

    return rows.map((row) => ({
      method: row.method,
      amountCents: Number(row.amountCents ?? 0),
      count: row.count,
    }));
  }

  async insertMovement(values: NewCashMovement): Promise<CashMovement> {
    const [row] = await this.db
      .insert(schema.cashMovements)
      .values(values)
      .returning();
    return row;
  }

  async findMovements(sessionId: string): Promise<CashMovement[]> {
    return this.db
      .select()
      .from(schema.cashMovements)
      .where(eq(schema.cashMovements.cashSessionId, sessionId));
  }

  async movementTotals(
    sessionId: string,
  ): Promise<{ paidInCents: number; paidOutCents: number }> {
    const [row] = await this.db
      .select({
        paidInCents: sql<string>`coalesce(sum(${schema.cashMovements.amountCents}) filter (where ${schema.cashMovements.direction} = 'in'), 0)`,
        paidOutCents: sql<string>`coalesce(sum(${schema.cashMovements.amountCents}) filter (where ${schema.cashMovements.direction} = 'out'), 0)`,
      })
      .from(schema.cashMovements)
      .where(eq(schema.cashMovements.cashSessionId, sessionId));

    return {
      paidInCents: Number(row?.paidInCents ?? 0),
      paidOutCents: Number(row?.paidOutCents ?? 0),
    };
  }

  private buildWhere(filters: ListCashSessionsFilters): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.cashSessions.businessId, filters.businessId),
    ];

    if (filters.branchId) {
      conditions.push(eq(schema.cashSessions.branchId, filters.branchId));
    }

    if (filters.status) {
      conditions.push(eq(schema.cashSessions.status, filters.status));
    }

    return and(...conditions);
  }
}

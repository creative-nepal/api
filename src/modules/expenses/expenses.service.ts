import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, type SQL, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, Expense } from '../../database/schema';
import {
  buildReport,
  MAX_EXPORT_ROWS,
  type ExportFormat,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting';
import { CashRepository } from '../cash/cash.repository';
import type { CreateExpenseDto, ListExpensesQueryDto } from './dto/expense.dto';

export interface ExpenseByCategory {
  category: string;
  entries: number;
  amountCents: number;
}

export interface ExpenseReport {
  totalCents: number;
  entries: number;
  byCategory: ExpenseByCategory[];
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly cashRepository: CashRepository,
  ) {}

  async list(
    businessId: string,
    branchId: string,
    query: ListExpensesQueryDto,
  ): Promise<PaginatedResult<Expense>> {
    const where = this.buildWhere(businessId, branchId, query);

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.expenses)
        .where(where)
        .orderBy(desc(schema.expenses.incurredAt))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(schema.expenses).where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async create(
    businessId: string,
    branchId: string,
    dto: CreateExpenseDto,
    actorUserId: string,
  ): Promise<Expense> {
    const session =
      dto.paidVia === 'cash'
        ? await this.cashRepository.findOpenSession(businessId, branchId)
        : undefined;

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.expenses)
        .values({
          id: randomUUID(),
          businessId,
          branchId,
          category: dto.category,
          description: dto.description,
          amountCents: dto.amountCents,
          paidVia: dto.paidVia,
          reference: dto.reference ?? null,
          cashSessionId: session?.id ?? null,
          ...(dto.incurredAt ? { incurredAt: new Date(dto.incurredAt) } : {}),
          actorUserId,
        })
        .returning();

      if (session) {
        await tx.insert(schema.cashMovements).values({
          id: randomUUID(),
          businessId,
          cashSessionId: session.id,
          direction: 'out',
          amountCents: dto.amountCents,
          reason: `${dto.category}: ${dto.description}`,
          actorUserId,
        });
      }

      return row;
    });
  }

  async export(
    business: Business,
    branchId: string,
    format: ExportFormat,
    limit: number,
  ): Promise<ReportExport> {
    const records = await this.db
      .select()
      .from(schema.expenses)
      .where(
        and(
          eq(schema.expenses.businessId, business.id),
          eq(schema.expenses.branchId, branchId),
        ),
      )
      .orderBy(desc(schema.expenses.incurredAt))
      .limit(Math.min(limit, MAX_EXPORT_ROWS));

    interface Row {
      date: string;
      category: string;
      description: string;
      paidVia: string;
      reference: string;
      amount: number;
    }

    const columns: ReportColumn<Row>[] = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Description', key: 'description', width: 34 },
      { header: 'Paid via', key: 'paidVia', width: 14 },
      { header: 'Reference', key: 'reference', width: 18 },
      { header: 'Amount', key: 'amount', width: 12 },
    ];

    const rows = records.map<Row>((record) => ({
      date: record.incurredAt.toISOString().slice(0, 10),
      category: record.category,
      description: record.description,
      paidVia: record.paidVia,
      reference: record.reference ?? '',
      amount: toRupees(record.amountCents),
    }));

    return buildReport(format, `expenses-${business.id.slice(0, 8)}`, {
      sheetName: 'Expenses',
      title: `${business.legalName} — expenses`,
      subtitle: [
        `${rows.length} entry(s)`,
        new Date().toISOString().slice(0, 10),
      ],
      columns,
      rows,
      totalColumns: ['amount'],
    });
  }

  async report(
    businessId: string,
    branchId: string,
    sinceDays: number,
  ): Promise<ExpenseReport> {
    const since = new Date(Date.now() - sinceDays * 86_400_000);

    const where = and(
      eq(schema.expenses.businessId, businessId),
      eq(schema.expenses.branchId, branchId),
      gte(schema.expenses.incurredAt, since),
    );

    const [byCategory, [totals]] = await Promise.all([
      this.db
        .select({
          category: schema.expenses.category,
          entries: count(),
          amountCents: sql<string>`coalesce(sum(${schema.expenses.amountCents}), 0)`,
        })
        .from(schema.expenses)
        .where(where)
        .groupBy(schema.expenses.category)
        .orderBy(sql`sum(${schema.expenses.amountCents}) desc`),
      this.db
        .select({
          entries: count(),
          amountCents: sql<string>`coalesce(sum(${schema.expenses.amountCents}), 0)`,
        })
        .from(schema.expenses)
        .where(where),
    ]);

    return {
      totalCents: Number(totals?.amountCents ?? 0),
      entries: totals?.entries ?? 0,
      byCategory: byCategory.map((row) => ({
        category: row.category,
        entries: row.entries,
        amountCents: Number(row.amountCents),
      })),
    };
  }

  private buildWhere(
    businessId: string,
    branchId: string,
    query: ListExpensesQueryDto,
  ): SQL | undefined {
    const conditions: SQL[] = [
      eq(schema.expenses.businessId, businessId),
      eq(schema.expenses.branchId, branchId),
    ];

    if (query.category) {
      conditions.push(eq(schema.expenses.category, query.category));
    }

    return and(...conditions);
  }
}

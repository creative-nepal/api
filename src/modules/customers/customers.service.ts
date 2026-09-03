import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type Database,
  type DatabaseExecutor,
  InjectDatabase,
  schema,
} from '../../database';
import type { Customer, CustomerLedgerEntry } from '../../database/schema';
import type {
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/customers.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async list(
    businessId: string,
    query: ListCustomersQueryDto,
  ): Promise<PaginatedResult<Customer>> {
    const term = query.search?.trim();

    const where = and(
      eq(schema.customers.businessId, businessId),
      ...(term
        ? [
            or(
              ilike(schema.customers.name, `%${term}%`),
              ilike(schema.customers.phone, `%${term}%`),
              ilike(schema.customers.email, `%${term}%`),
            ),
          ]
        : []),
      ...(query.owing === 'true' ? [gt(schema.customers.balanceCents, 0)] : []),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.customers)
        .where(where)
        .orderBy(desc(schema.customers.balanceCents))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(schema.customers).where(where),
    ]);

    return {
      data: rows,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getById(businessId: string, customerId: string): Promise<Customer> {
    const [row] = await this.db
      .select()
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.id, customerId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.customer.notFound',
        customerId,
      });
    }

    return row;
  }

  async create(businessId: string, dto: CreateCustomerDto): Promise<Customer> {
    const [row] = await this.db
      .insert(schema.customers)
      .values({
        id: randomUUID(),
        businessId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        panNumber: dto.panNumber ?? null,
        creditLimitCents: dto.creditLimitCents ?? 0,
        balanceCents: 0,
      })
      .returning();

    return row;
  }

  async update(
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<Customer> {
    await this.getById(businessId, customerId);

    const [row] = await this.db
      .update(schema.customers)
      .set({
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.phone === undefined ? {} : { phone: dto.phone }),
        ...(dto.email === undefined ? {} : { email: dto.email }),
        ...(dto.creditLimitCents === undefined
          ? {}
          : { creditLimitCents: dto.creditLimitCents }),
      })
      .where(eq(schema.customers.id, customerId))
      .returning();

    return row;
  }

  async ledger(
    businessId: string,
    customerId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<CustomerLedgerEntry>> {
    await this.getById(businessId, customerId);

    const where = and(
      eq(schema.customerLedgerEntries.businessId, businessId),
      eq(schema.customerLedgerEntries.customerId, customerId),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.customerLedgerEntries)
        .where(where)
        .orderBy(desc(schema.customerLedgerEntries.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.customerLedgerEntries)
        .where(where),
    ]);

    return { data: rows, total: total?.value ?? 0, limit, offset };
  }

  /**
   * Puts a sale on the customer's account. The limit is checked against the
   * balance the update itself produces, inside one statement, so two tills
   * cannot both squeeze a sale past the same remaining credit.
   */
  async chargeSale(
    executor: DatabaseExecutor,
    businessId: string,
    customerId: string,
    amountCents: number,
    invoiceId: string | null,
    actorUserId: string | null,
  ): Promise<CustomerLedgerEntry> {
    const [customer] = await executor
      .update(schema.customers)
      .set({
        balanceCents: sql`${schema.customers.balanceCents} + ${amountCents}`,
      })
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          eq(schema.customers.id, customerId),
          sql`${schema.customers.balanceCents} + ${amountCents} <= ${schema.customers.creditLimitCents}`,
        ),
      )
      .returning();

    if (!customer) {
      const existing = await this.getById(businessId, customerId);

      throw new BadRequestException({
        message: 'i18n:errors.customer.creditLimitExceeded',
        limit: existing.creditLimitCents,
        balance: existing.balanceCents,
        amount: amountCents,
      });
    }

    const [entry] = await executor
      .insert(schema.customerLedgerEntries)
      .values({
        id: randomUUID(),
        businessId,
        customerId,
        type: 'sale',
        amountCents,
        balanceAfterCents: customer.balanceCents,
        invoiceId,
        actorUserId,
      })
      .returning();

    return entry;
  }

  async recordPayment(
    businessId: string,
    customerId: string,
    amountCents: number,
    note: string | null,
    actorUserId: string | null,
  ): Promise<CustomerLedgerEntry> {
    const customer = await this.getById(businessId, customerId);

    if (amountCents > customer.balanceCents) {
      throw new BadRequestException({
        message: 'i18n:errors.customer.overPayment',
        balance: customer.balanceCents,
        amount: amountCents,
      });
    }

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.customers)
        .set({
          balanceCents: sql`${schema.customers.balanceCents} - ${amountCents}`,
        })
        .where(eq(schema.customers.id, customerId))
        .returning();

      const [entry] = await tx
        .insert(schema.customerLedgerEntries)
        .values({
          id: randomUUID(),
          businessId,
          customerId,
          type: 'payment',
          amountCents: -amountCents,
          balanceAfterCents: updated.balanceCents,
          note,
          actorUserId,
        })
        .returning();

      return entry;
    });
  }
}

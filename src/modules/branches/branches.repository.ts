import { Injectable } from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Branch, NewBranch } from '../../database/schema';

@Injectable()
export class BranchesRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findMany(
    businessId: string,
    limit: number,
    offset: number,
    isActive?: boolean,
  ): Promise<{ rows: Branch[]; total: number }> {
    const where = and(
      eq(schema.branches.businessId, businessId),
      ...(isActive === undefined
        ? []
        : [eq(schema.branches.isActive, isActive)]),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.branches)
        .where(where)
        .orderBy(asc(schema.branches.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(schema.branches).where(where),
    ]);

    return { rows, total: total?.value ?? 0 };
  }

  async findById(
    businessId: string,
    branchId: string,
  ): Promise<Branch | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.branches.id, branchId),
        ),
      )
      .limit(1);

    return row;
  }

  async findDefault(businessId: string): Promise<Branch | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.branches.isDefault, true),
        ),
      )
      .limit(1);

    return row;
  }

  async insert(values: NewBranch): Promise<Branch> {
    const [row] = await this.db
      .insert(schema.branches)
      .values(values)
      .returning();
    return row;
  }

  async update(
    businessId: string,
    branchId: string,
    patch: Partial<NewBranch>,
  ): Promise<Branch | undefined> {
    const [row] = await this.db
      .update(schema.branches)
      .set(patch)
      .where(
        and(
          eq(schema.branches.businessId, businessId),
          eq(schema.branches.id, branchId),
        ),
      )
      .returning();

    return row;
  }

  async countIssuedInvoices(branchId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.businessInvoices)
      .where(eq(schema.businessInvoices.branchId, branchId));

    return row?.value ?? 0;
  }
}

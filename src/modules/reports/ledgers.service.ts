import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import {
  type AgingBuckets,
  type AgingCharge,
  bucket,
  settleOldestFirst,
} from './aging';

export interface PartyAging extends AgingBuckets {
  partyId: string;
  name: string;
  phone: string | null;
}

export interface AgingReport {
  asOf: string;
  parties: PartyAging[];
  totals: AgingBuckets;
}

function sumBuckets(parties: PartyAging[]): AgingBuckets {
  return parties.reduce<AgingBuckets>(
    (total, party) => ({
      currentCents: total.currentCents + party.currentCents,
      days31To60Cents: total.days31To60Cents + party.days31To60Cents,
      days61To90Cents: total.days61To90Cents + party.days61To90Cents,
      over90Cents: total.over90Cents + party.over90Cents,
      totalCents: total.totalCents + party.totalCents,
      oldestDays: Math.max(total.oldestDays, party.oldestDays),
    }),
    {
      currentCents: 0,
      days31To60Cents: 0,
      days61To90Cents: 0,
      over90Cents: 0,
      totalCents: 0,
      oldestDays: 0,
    },
  );
}

@Injectable()
export class LedgersService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async receivables(businessId: string, asOf: Date): Promise<AgingReport> {
    const owing = await this.db
      .select({
        id: schema.customers.id,
        name: schema.customers.name,
        phone: schema.customers.phone,
      })
      .from(schema.customers)
      .where(
        and(
          eq(schema.customers.businessId, businessId),
          gt(schema.customers.balanceCents, 0),
        ),
      );

    if (owing.length === 0) {
      return { asOf: asOf.toISOString(), parties: [], totals: sumBuckets([]) };
    }

    const entries = await this.db
      .select({
        customerId: schema.customerLedgerEntries.customerId,
        type: schema.customerLedgerEntries.type,
        amountCents: schema.customerLedgerEntries.amountCents,
        createdAt: schema.customerLedgerEntries.createdAt,
      })
      .from(schema.customerLedgerEntries)
      .where(eq(schema.customerLedgerEntries.businessId, businessId))
      .orderBy(asc(schema.customerLedgerEntries.createdAt));

    const charges = new Map<string, AgingCharge[]>();
    const settled = new Map<string, number>();

    for (const entry of entries) {
      if (entry.createdAt > asOf) {
        continue;
      }

      if (entry.type === 'sale' && entry.amountCents > 0) {
        charges.set(entry.customerId, [
          ...(charges.get(entry.customerId) ?? []),
          { amountCents: entry.amountCents, at: entry.createdAt },
        ]);
        continue;
      }

      settled.set(
        entry.customerId,
        (settled.get(entry.customerId) ?? 0) + Math.abs(entry.amountCents),
      );
    }

    const parties = owing
      .map((customer) => ({
        partyId: customer.id,
        name: customer.name,
        phone: customer.phone,
        ...bucket(
          settleOldestFirst(
            charges.get(customer.id) ?? [],
            settled.get(customer.id) ?? 0,
          ),
          asOf,
        ),
      }))
      .filter((party) => party.totalCents > 0)
      .sort((a, b) => b.totalCents - a.totalCents);

    return {
      asOf: asOf.toISOString(),
      parties,
      totals: sumBuckets(parties),
    };
  }

  async payables(businessId: string, asOf: Date): Promise<AgingReport> {
    const rows = await this.db
      .select({
        supplierId: schema.purchaseBills.supplierId,
        name: schema.suppliers.name,
        contact: schema.suppliers.contact,
        totalCents: schema.purchaseBills.totalCents,
        tdsAmountCents: schema.purchaseBills.tdsAmountCents,
        paidCents: schema.purchaseBills.paidCents,
        billDate: schema.purchaseBills.billDate,
        dueDate: schema.purchaseBills.dueDate,
      })
      .from(schema.purchaseBills)
      .innerJoin(
        schema.suppliers,
        eq(schema.suppliers.id, schema.purchaseBills.supplierId),
      )
      .where(
        and(
          eq(schema.purchaseBills.businessId, businessId),
          sql`${schema.purchaseBills.status} <> 'cancelled'`,
        ),
      );

    const bySupplier = new Map<
      string,
      { name: string; phone: string | null; charges: AgingCharge[] }
    >();

    for (const row of rows) {
      const at = new Date(`${row.dueDate ?? row.billDate}T00:00:00Z`);

      if (at > asOf) {
        continue;
      }

      const outstanding = row.totalCents - row.tdsAmountCents - row.paidCents;

      if (outstanding <= 0) {
        continue;
      }

      const entry = bySupplier.get(row.supplierId) ?? {
        name: row.name,
        phone: row.contact,
        charges: [] as AgingCharge[],
      };

      entry.charges.push({ amountCents: outstanding, at });
      bySupplier.set(row.supplierId, entry);
    }

    const parties = [...bySupplier.entries()]
      .map(([supplierId, entry]) => ({
        partyId: supplierId,
        name: entry.name,
        phone: entry.phone,
        ...bucket(entry.charges, asOf),
      }))
      .sort((a, b) => b.totalCents - a.totalCents);

    return {
      asOf: asOf.toISOString(),
      parties,
      totals: sumBuckets(parties),
    };
  }
}

import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  buildReport,
  MAX_EXPORT_ROWS,
  type ExportFormat,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';
import type {
  CustomerImportRowDto,
  ImportCustomersDto,
} from './dto/customer-import.dto';
import type {
  ImportRowResult,
  ImportSummary,
} from '../products/products-import.service';

interface CustomerExportRow {
  name: string;
  phone: string;
  email: string;
  panNumber: string;
  creditLimit: number;
  balance: number;
  loyaltyPoints: number;
}

const COLUMNS: ReportColumn<CustomerExportRow>[] = [
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'PAN', key: 'panNumber', width: 14 },
  { header: 'Credit limit', key: 'creditLimit', width: 14 },
  { header: 'Balance owing', key: 'balance', width: 14 },
  { header: 'Loyalty points', key: 'loyaltyPoints', width: 14 },
];

@Injectable()
export class CustomersExportService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async export(
    business: Business,
    format: ExportFormat,
    limit: number,
  ): Promise<ReportExport> {
    const customers = await this.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.businessId, business.id))
      .orderBy(asc(schema.customers.name))
      .limit(Math.min(limit, MAX_EXPORT_ROWS));

    const rows = customers.map<CustomerExportRow>((customer) => ({
      name: customer.name,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      panNumber: customer.panNumber ?? '',
      creditLimit: toRupees(customer.creditLimitCents),
      balance: toRupees(customer.balanceCents),
      loyaltyPoints: customer.loyaltyPoints,
    }));

    return buildReport(format, `customers-${business.id.slice(0, 8)}`, {
      sheetName: 'Customers',
      title: `${business.legalName} — customers`,
      subtitle: [
        `${rows.length} customer(s)`,
        new Date().toISOString().slice(0, 10),
      ],
      columns: COLUMNS,
      rows,
      totalColumns: ['balance', 'creditLimit'],
    });
  }

  async import(
    business: Business,
    dto: ImportCustomersDto,
  ): Promise<ImportSummary> {
    const dryRun = dto.dryRun ?? false;
    const results: ImportRowResult[] = [];

    const phones = dto.rows
      .map((row) => row.phone?.trim())
      .filter((phone): phone is string => Boolean(phone));

    const existing =
      phones.length > 0
        ? await this.db
            .select()
            .from(schema.customers)
            .where(
              and(
                eq(schema.customers.businessId, business.id),
                inArray(schema.customers.phone, phones),
              ),
            )
        : [];

    const byPhone = new Map(
      existing
        .filter((customer) => customer.phone !== null)
        .map((customer) => [customer.phone as string, customer]),
    );

    const names = dto.rows.map((row) => row.name.trim());

    const byName = new Map(
      (names.length > 0
        ? await this.db
            .select()
            .from(schema.customers)
            .where(
              and(
                eq(schema.customers.businessId, business.id),
                inArray(schema.customers.name, names),
              ),
            )
        : []
      ).map((customer) => [customer.name, customer]),
    );

    const seen = new Set<string>();
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const row of dto.rows) {
      const phone = row.phone?.trim() || null;

      if (phone && seen.has(phone)) {
        failed += 1;
        results.push({
          rowNumber: row.rowNumber,
          sku: phone,
          name: row.name,
          outcome: 'failed',
          reason: `Phone ${phone} appears more than once in this file`,
        });
        continue;
      }

      if (phone) {
        seen.add(phone);
      }

      const match = phone ? byPhone.get(phone) : byName.get(row.name.trim());

      if (match) {
        updated += 1;

        if (!dryRun) {
          await this.db
            .update(schema.customers)
            .set(this.patchFor(row))
            .where(eq(schema.customers.id, match.id));
        }

        results.push({
          rowNumber: row.rowNumber,
          sku: phone,
          name: row.name,
          outcome: 'updated',
        });
        continue;
      }

      created += 1;

      if (!dryRun) {
        await this.db.insert(schema.customers).values({
          id: randomUUID(),
          businessId: business.id,
          name: row.name,
          phone,
          email: row.email ?? null,
          panNumber: row.panNumber ?? null,
          creditLimitCents: row.creditLimitCents ?? 0,
        });
      }

      results.push({
        rowNumber: row.rowNumber,
        sku: phone,
        name: row.name,
        outcome: 'created',
      });
    }

    return { dryRun, created, updated, failed, results };
  }

  private patchFor(row: CustomerImportRowDto): Record<string, unknown> {
    return {
      name: row.name,
      ...(row.email !== undefined && { email: row.email }),
      ...(row.panNumber !== undefined && { panNumber: row.panNumber }),
      ...(row.creditLimitCents !== undefined && {
        creditLimitCents: row.creditLimitCents,
      }),
    };
  }
}

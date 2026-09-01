import { Injectable } from '@nestjs/common';
import { and, asc, eq, gt, gte, lte } from 'drizzle-orm';
import {
  buildReport,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting/spreadsheet';
import { type Database, InjectDatabase, schema } from '../../database';
import { BASIS_POINTS_DIVISOR, type Business } from '../../database/schema';
import { toBikramSambat } from '../invoices/fiscal-year';

export interface TdsRow {
  dateBs: string;
  dateAd: string;
  supplierName: string;
  supplierPan: string;
  billNumber: string;
  base: number;
  rate: number;
  tds: number;
  net: number;
}

export interface TdsExport extends ReportExport {
  totalTdsCents: number;
}

const COLUMNS: readonly ReportColumn<TdsRow>[] = [
  { header: 'मिति (Date BS)', key: 'dateBs', width: 14 },
  { header: 'Date (AD)', key: 'dateAd', width: 14 },
  { header: 'आपूर्तिकर्ता (Payee)', key: 'supplierName', width: 26 },
  { header: 'PAN', key: 'supplierPan', width: 16 },
  { header: 'बिल नं.', key: 'billNumber', width: 16 },
  { header: 'भुक्तानी आधार (Taxable Base)', key: 'base', width: 22 },
  { header: 'दर % (Rate)', key: 'rate', width: 12 },
  { header: 'कट्टी रकम (TDS)', key: 'tds', width: 16 },
  { header: 'खुद भुक्तानी (Net Paid)', key: 'net', width: 20 },
];

@Injectable()
export class TdsReportService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async buildRows(
    businessId: string,
    from: string,
    to: string,
  ): Promise<TdsRow[]> {
    const rows = await this.db
      .select({
        billDate: schema.purchaseBills.billDate,
        billNumber: schema.purchaseBills.billNumber,
        supplierName: schema.suppliers.name,
        supplierPan: schema.suppliers.panNumber,
        subtotalCents: schema.purchaseBills.subtotalCents,
        totalCents: schema.purchaseBills.totalCents,
        rateBasisPoints: schema.purchaseBills.tdsRateBasisPoints,
        tdsAmountCents: schema.purchaseBills.tdsAmountCents,
      })
      .from(schema.purchaseBills)
      .innerJoin(
        schema.suppliers,
        eq(schema.suppliers.id, schema.purchaseBills.supplierId),
      )
      .where(
        and(
          eq(schema.purchaseBills.businessId, businessId),
          gt(schema.purchaseBills.tdsAmountCents, 0),
          gte(schema.purchaseBills.billDate, from),
          lte(schema.purchaseBills.billDate, to),
        ),
      )
      .orderBy(asc(schema.purchaseBills.billDate));

    return rows.map((row) => ({
      dateBs: toBikramSambat(new Date(`${row.billDate}T06:00:00Z`)).formatted,
      dateAd: row.billDate,
      supplierName: row.supplierName,
      supplierPan: row.supplierPan ?? 'MISSING',
      billNumber: row.billNumber,
      base: toRupees(row.subtotalCents),
      rate: row.rateBasisPoints / (BASIS_POINTS_DIVISOR / 100),
      tds: toRupees(row.tdsAmountCents),
      net: toRupees(row.totalCents - row.tdsAmountCents),
    }));
  }

  async export(
    business: Business,
    from: string,
    to: string,
    format: 'xlsx' | 'csv',
  ): Promise<TdsExport> {
    const rows = await this.buildRows(business.id, from, to);

    const report = await buildReport(
      format,
      `tds-return-${business.id}-${from}_${to}`,
      {
        sheetName: 'TDS',
        title: `${business.legalName} — TDS Deducted at Source`,
        subtitle: [`PAN: ${business.panNumber ?? 'N/A'}`, `${from} to ${to}`],
        columns: COLUMNS,
        rows,
        totalColumns: ['base', 'tds', 'net'],
      },
    );

    return {
      ...report,
      totalTdsCents: Math.round(
        rows.reduce((sum, row) => sum + row.tds, 0) * 100,
      ),
    };
  }
}

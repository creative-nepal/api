import { Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import {
  buildReport,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting/spreadsheet';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business } from '../../database/schema';
import { toBikramSambat } from '../invoices/fiscal-year';

export interface PurchaseRegisterRow {
  dateBs: string;
  dateAd: string;
  billNumber: string;
  supplierName: string;
  supplierPan: string;
  description: string;
  total: number;
  exempt: number;
  taxable: number;
  vat: number;
}

const COLUMNS: readonly ReportColumn<PurchaseRegisterRow>[] = [
  { header: 'मिति (Date BS)', key: 'dateBs', width: 14 },
  { header: 'Date (AD)', key: 'dateAd', width: 14 },
  { header: 'बिल नं. (Bill No.)', key: 'billNumber', width: 16 },
  { header: 'आपूर्तिकर्ता (Supplier)', key: 'supplierName', width: 26 },
  { header: 'आपूर्तिकर्ता PAN', key: 'supplierPan', width: 18 },
  { header: 'वस्तु/सेवाको विवरण', key: 'description', width: 26 },
  { header: 'जम्मा खरिद (Total Purchase)', key: 'total', width: 20 },
  { header: 'कर छुट खरिद (Exempt)', key: 'exempt', width: 18 },
  { header: 'करयोग्य खरिद (Taxable)', key: 'taxable', width: 20 },
  { header: 'कर रकम (VAT)', key: 'vat', width: 14 },
];

interface RegisterSource {
  billDate: string;
  billNumber: string;
  supplierName: string;
  supplierPan: string | null;
  description: string;
  lineTotalCents: number;
  vatCents: number;
}

function toRegisterRow(source: RegisterSource): PurchaseRegisterRow {
  const isVatable = source.vatCents !== 0;

  return {
    dateBs: toBikramSambat(new Date(`${source.billDate}T06:00:00Z`)).formatted,
    dateAd: source.billDate,
    billNumber: source.billNumber,
    supplierName: source.supplierName,
    supplierPan: source.supplierPan ?? '',
    description: source.description,
    total: toRupees(source.lineTotalCents + source.vatCents),
    exempt: isVatable ? 0 : toRupees(source.lineTotalCents),
    taxable: isVatable ? toRupees(source.lineTotalCents) : 0,
    vat: toRupees(source.vatCents),
  };
}

@Injectable()
export class PurchaseRegisterService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async buildRows(
    businessId: string,
    from: string,
    to: string,
  ): Promise<PurchaseRegisterRow[]> {
    const rows = await this.db
      .select({
        billNumber: schema.purchaseBills.billNumber,
        billDate: schema.purchaseBills.billDate,
        supplierName: schema.suppliers.name,
        supplierPan: schema.suppliers.panNumber,
        description: schema.purchaseBillItems.description,
        lineTotalCents: schema.purchaseBillItems.lineTotalCents,
        vatCents: schema.purchaseBillItems.vatCents,
      })
      .from(schema.purchaseBillItems)
      .innerJoin(
        schema.purchaseBills,
        eq(schema.purchaseBills.id, schema.purchaseBillItems.purchaseBillId),
      )
      .innerJoin(
        schema.suppliers,
        eq(schema.suppliers.id, schema.purchaseBills.supplierId),
      )
      .where(
        and(
          eq(schema.purchaseBillItems.businessId, businessId),
          gte(schema.purchaseBills.billDate, from),
          lte(schema.purchaseBills.billDate, to),
        ),
      )
      .orderBy(asc(schema.purchaseBills.billDate));

    const returnRows = await this.db
      .select({
        noteNumber: schema.debitNotes.noteNumber,
        series: schema.debitNotes.series,
        issuedAt: schema.debitNotes.issuedAt,
        supplierName: schema.suppliers.name,
        supplierPan: schema.suppliers.panNumber,
        description: schema.debitNoteItems.description,
        lineTotalCents: schema.debitNoteItems.lineTotalCents,
        vatCents: schema.debitNoteItems.vatCents,
      })
      .from(schema.debitNoteItems)
      .innerJoin(
        schema.debitNotes,
        eq(schema.debitNotes.id, schema.debitNoteItems.debitNoteId),
      )
      .innerJoin(
        schema.suppliers,
        eq(schema.suppliers.id, schema.debitNotes.supplierId),
      )
      .where(
        and(
          eq(schema.debitNoteItems.businessId, businessId),
          gte(schema.debitNotes.issuedAt, new Date(`${from}T00:00:00Z`)),
          lte(schema.debitNotes.issuedAt, new Date(`${to}T23:59:59Z`)),
        ),
      )
      .orderBy(asc(schema.debitNotes.issuedAt));

    const purchases = rows.map((row) =>
      toRegisterRow({
        billDate: row.billDate,
        billNumber: row.billNumber,
        supplierName: row.supplierName,
        supplierPan: row.supplierPan,
        description: row.description,
        lineTotalCents: row.lineTotalCents,
        vatCents: row.vatCents,
      }),
    );

    const returns = returnRows.map((row) =>
      toRegisterRow({
        billDate: row.issuedAt.toISOString().slice(0, 10),
        billNumber: `DN ${row.series}-${row.noteNumber}`,
        supplierName: row.supplierName,
        supplierPan: row.supplierPan,
        description: row.description,
        lineTotalCents: -row.lineTotalCents,
        vatCents: -row.vatCents,
      }),
    );

    return [...purchases, ...returns].sort((left, right) =>
      left.dateAd.localeCompare(right.dateAd),
    );
  }

  async export(
    business: Business,
    from: string,
    to: string,
    format: 'xlsx' | 'csv',
  ): Promise<ReportExport> {
    return buildReport(
      format,
      `purchase-register-${business.id}-${from}_${to}`,
      {
        sheetName: 'Kharid Khata',
        title: `${business.legalName} — Purchase Register (Kharid Khata)`,
        subtitle: [`PAN: ${business.panNumber ?? 'N/A'}`, `${from} to ${to}`],
        columns: COLUMNS,
        rows: await this.buildRows(business.id, from, to),
        totalColumns: ['total', 'exempt', 'taxable', 'vat'],
      },
    );
  }
}

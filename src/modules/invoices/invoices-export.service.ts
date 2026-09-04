import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, type SQL, sql } from 'drizzle-orm';
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
import { toBikramSambat } from './fiscal-year';

interface InvoiceExportRow {
  dateBs: string;
  dateAd: string;
  invoiceNumber: string;
  fiscalYear: string;
  status: string;
  customer: string;
  customerPan: string;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  vat: number;
  total: number;
  paidVia: string;
}

const COLUMNS: ReportColumn<InvoiceExportRow>[] = [
  { header: 'Date (BS)', key: 'dateBs', width: 14 },
  { header: 'Date (AD)', key: 'dateAd', width: 12 },
  { header: 'Invoice', key: 'invoiceNumber', width: 12 },
  { header: 'Fiscal year', key: 'fiscalYear', width: 12 },
  { header: 'Status', key: 'status', width: 12 },
  { header: 'Customer', key: 'customer', width: 26 },
  { header: 'Buyer PAN', key: 'customerPan', width: 14 },
  { header: 'Subtotal', key: 'subtotal', width: 12 },
  { header: 'Discount', key: 'discount', width: 12 },
  { header: 'Service charge', key: 'serviceCharge', width: 14 },
  { header: 'VAT', key: 'vat', width: 12 },
  { header: 'Total', key: 'total', width: 12 },
  { header: 'Paid via', key: 'paidVia', width: 20 },
];

@Injectable()
export class InvoicesExportService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async export(
    business: Business,
    format: ExportFormat,
    filters: {
      branchId?: string;
      fiscalYear?: string;
      status?: string;
      from?: string;
      to?: string;
    },
    limit: number,
  ): Promise<ReportExport> {
    const conditions: SQL[] = [
      eq(schema.businessInvoices.businessId, business.id),
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
      conditions.push(
        gte(schema.businessInvoices.createdAt, new Date(filters.from)),
      );
    }

    if (filters.to) {
      conditions.push(
        lte(schema.businessInvoices.createdAt, new Date(filters.to)),
      );
    }

    const invoices = await this.db
      .select({
        invoice: schema.businessInvoices,

        paidVia: sql<string | null>`(
          select string_agg(distinct ${schema.invoicePayments.method}, ', ')
          from ${schema.invoicePayments}
          where ${schema.invoicePayments.invoiceId} = ${schema.businessInvoices.id}
        )`,
      })
      .from(schema.businessInvoices)
      .where(and(...conditions))
      .orderBy(desc(schema.businessInvoices.createdAt))
      .limit(Math.min(limit, MAX_EXPORT_ROWS));

    const rows = invoices.map<InvoiceExportRow>(({ invoice, paidVia }) => ({
      dateBs: toBikramSambat(invoice.createdAt).formatted,
      dateAd: invoice.createdAt.toISOString().slice(0, 10),
      invoiceNumber:
        invoice.status === 'credit_note'
          ? `CN-${invoice.invoiceNumber}`
          : String(invoice.invoiceNumber),
      fiscalYear: invoice.fiscalYear,
      status: invoice.status,
      customer: invoice.customerName ?? '',
      customerPan: invoice.customerPan ?? '',
      subtotal: toRupees(invoice.subtotalCents),
      discount: toRupees(invoice.discountCents),
      serviceCharge: toRupees(invoice.serviceChargeCents),
      vat: toRupees(invoice.vatCents),
      total: toRupees(invoice.totalCents),
      paidVia: paidVia ?? '',
    }));

    return buildReport(format, `invoices-${business.id.slice(0, 8)}`, {
      sheetName: 'Invoices',
      title: `${business.legalName} — invoices`,
      subtitle: [
        `${rows.length} invoice(s)`,
        filters.fiscalYear ?? '',
        new Date().toISOString().slice(0, 10),
      ].filter(Boolean),
      columns: COLUMNS,
      rows,
      totalColumns: ['subtotal', 'discount', 'serviceCharge', 'vat', 'total'],
    });
  }
}

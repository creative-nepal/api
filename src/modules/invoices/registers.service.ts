import { Injectable } from '@nestjs/common';
import {
  buildReport,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting/spreadsheet';
import type { Business, BusinessInvoice } from '../../database/schema';
import { toBikramSambat } from './fiscal-year';
import { InvoicesRepository } from './invoices.repository';
import { VAT_RATE_PERCENT } from './vat';

export type RegisterFormat = 'xlsx' | 'csv';

export interface RegisterRow {
  dateBs: string;
  dateAd: string;
  invoiceNumber: string;
  buyerName: string;
  buyerPan: string;
  description: string;
  totalSales: number;
  exemptSales: number;
  taxableSales: number;
  vatAmount: number;
}

const COLUMNS: readonly ReportColumn<RegisterRow>[] = [
  { header: 'मिति (Date BS)', key: 'dateBs', width: 14 },
  { header: 'Date (AD)', key: 'dateAd', width: 14 },
  { header: 'बिल नं. (Invoice No.)', key: 'invoiceNumber', width: 16 },
  { header: 'खरिदकर्ताको नाम (Buyer Name)', key: 'buyerName', width: 28 },
  { header: 'खरिदकर्ताको PAN (Buyer PAN)', key: 'buyerPan', width: 18 },
  { header: 'वस्तु/सेवाको विवरण (Description)', key: 'description', width: 26 },
  { header: 'जम्मा बिक्री (Total Sales)', key: 'totalSales', width: 18 },
  { header: 'कर छुट बिक्री (Exempt Sales)', key: 'exemptSales', width: 20 },
  { header: 'करयोग्य बिक्री (Taxable Sales)', key: 'taxableSales', width: 20 },
  { header: `कर रकम (VAT ${VAT_RATE_PERCENT}%)`, key: 'vatAmount', width: 16 },
];

@Injectable()
export class RegistersService {
  constructor(private readonly invoicesRepository: InvoicesRepository) {}

  async buildRows(
    businessId: string,
    fiscalYear: string,
  ): Promise<RegisterRow[]> {
    const invoices = await this.invoicesRepository.findAllForFiscalYear(
      businessId,
      fiscalYear,
    );

    return invoices.map((invoice) => this.toRow(invoice));
  }

  async export(
    business: Business,
    fiscalYear: string,
    format: RegisterFormat,
  ): Promise<ReportExport> {
    return buildReport(format, `sales-register-${business.id}-${fiscalYear}`, {
      sheetName: `Bikri Khata ${fiscalYear}`,
      title: `${business.legalName} — Sales Register (Annexure 13)`,
      subtitle: [
        `PAN: ${business.panNumber ?? 'N/A'}`,
        `Fiscal Year: ${fiscalYear}`,
      ],
      columns: COLUMNS,
      rows: await this.buildRows(business.id, fiscalYear),
      totalColumns: ['totalSales', 'exemptSales', 'taxableSales', 'vatAmount'],
    });
  }

  private toRow(invoice: BusinessInvoice): RegisterRow {
    const sign = invoice.status === 'credit_note' ? -1 : 1;
    const isVatable = invoice.vatCents > 0;

    return {
      dateBs: toBikramSambat(invoice.createdAt).formatted,
      dateAd: invoice.createdAt.toISOString().slice(0, 10),
      invoiceNumber:
        invoice.status === 'credit_note'
          ? `CN-${invoice.invoiceNumber}`
          : String(invoice.invoiceNumber),
      buyerName: invoice.customerName ?? '',
      buyerPan: invoice.customerPan ?? '',
      description:
        invoice.status === 'credit_note' ? 'Credit note' : 'Goods/Services',
      totalSales: toRupees(sign * invoice.totalCents),
      exemptSales: isVatable ? 0 : toRupees(sign * invoice.subtotalCents),
      taxableSales: isVatable ? toRupees(sign * invoice.subtotalCents) : 0,
      vatAmount: toRupees(sign * invoice.vatCents),
    };
  }
}

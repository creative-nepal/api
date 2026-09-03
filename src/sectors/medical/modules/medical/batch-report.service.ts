import { Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  buildReport,
  type ReportColumn,
  type ReportExport,
} from '../../../../common/reporting/spreadsheet';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, MedicalProductData } from '../../../../database/schema';

export type ReportFormat = 'xlsx' | 'csv';

export interface BatchReportRow {
  productName: string;
  genericName: string;
  manufacturer: string;
  schedule: string;
  batchNo: string;
  expiryDate: string;
  dispensedQty: number;
  remainingQty: number;
  saleValue: number;
  invoiceNumbers: string;
}

const COLUMNS: readonly ReportColumn<BatchReportRow>[] = [
  { header: 'Product', key: 'productName', width: 28 },
  { header: 'Generic', key: 'genericName', width: 22 },
  { header: 'Manufacturer', key: 'manufacturer', width: 22 },
  { header: 'Schedule', key: 'schedule', width: 14 },
  { header: 'Batch No.', key: 'batchNo', width: 16 },
  { header: 'Expiry', key: 'expiryDate', width: 14 },
  { header: 'Dispensed Qty', key: 'dispensedQty', width: 15 },
  { header: 'Remaining Qty', key: 'remainingQty', width: 15 },
  { header: 'Sale Value', key: 'saleValue', width: 14 },
  { header: 'Invoice Nos.', key: 'invoiceNumbers', width: 22 },
];

@Injectable()
export class BatchReportService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async buildRows(
    businessId: string,
    fiscalYear?: string,
  ): Promise<BatchReportRow[]> {
    const rows = await this.db
      .select({
        productName: schema.products.name,
        sectorData: schema.products.sectorData,
        batchNo: schema.productBatches.batchNo,
        expiryDate: schema.productBatches.expiryDate,
        remainingQty: schema.productBatches.qty,
        dispensedQty: sql<string>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
        saleValueCents: sql<number>`COALESCE(SUM(${schema.orderItems.lineTotalCents}), 0)`,
        invoiceNumbers: sql<string>`COALESCE(STRING_AGG(DISTINCT ${schema.businessInvoices.invoiceNumber}::text, ', '), '')`,
      })
      .from(schema.productBatches)
      .innerJoin(
        schema.products,
        eq(schema.products.id, schema.productBatches.productId),
      )
      .leftJoin(
        schema.orderItems,
        eq(schema.orderItems.batchId, schema.productBatches.id),
      )
      .leftJoin(
        schema.businessInvoices,
        and(
          eq(schema.businessInvoices.orderId, schema.orderItems.orderId),
          fiscalYear
            ? eq(schema.businessInvoices.fiscalYear, fiscalYear)
            : sql`TRUE`,
        ),
      )
      .where(eq(schema.productBatches.businessId, businessId))
      .groupBy(
        schema.products.name,
        schema.products.sectorData,
        schema.productBatches.id,
        schema.productBatches.batchNo,
        schema.productBatches.expiryDate,
        schema.productBatches.qty,
      )
      .orderBy(
        asc(schema.products.name),
        asc(schema.productBatches.expiryDate),
      );

    return rows.map((row) => {
      const data = (row.sectorData ?? {}) as MedicalProductData;

      return {
        productName: row.productName,
        genericName: data.genericName ?? '',
        manufacturer: data.manufacturer ?? '',
        schedule: data.schedule ?? 'otc',
        batchNo: row.batchNo,
        expiryDate: row.expiryDate,
        dispensedQty: Number(row.dispensedQty),
        remainingQty: Number(row.remainingQty),
        saleValue: Number((Number(row.saleValueCents) / 100).toFixed(2)),
        invoiceNumbers: row.invoiceNumbers,
      };
    });
  }

  async export(
    business: Business,
    fiscalYear: string | undefined,
    format: ReportFormat,
  ): Promise<ReportExport> {
    return buildReport(
      format,
      `batch-report-${business.id}-${fiscalYear ?? 'all'}`,
      {
        sheetName: 'Batch Report',
        title: `${business.legalName} — Batch-wise Sales & Stock`,
        subtitle: [
          `PAN: ${business.panNumber ?? 'N/A'}`,
          `Fiscal Year: ${fiscalYear ?? 'All'}`,
        ],
        columns: COLUMNS,
        rows: await this.buildRows(business.id, fiscalYear),
      },
    );
  }
}

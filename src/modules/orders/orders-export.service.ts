import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm';
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

interface SoldItemRow {
  date: string;
  orderStatus: string;
  source: string;
  channel: string;
  item: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  customer: string;
}

const COLUMNS: ReportColumn<SoldItemRow>[] = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Status', key: 'orderStatus', width: 12 },
  { header: 'Source', key: 'source', width: 12 },
  { header: 'Channel', key: 'channel', width: 16 },
  { header: 'Item', key: 'item', width: 32 },
  { header: 'Quantity', key: 'quantity', width: 12 },
  { header: 'Unit price', key: 'unitPrice', width: 12 },
  { header: 'Discount', key: 'discount', width: 12 },
  { header: 'Line total', key: 'lineTotal', width: 12 },
  { header: 'Customer', key: 'customer', width: 24 },
];

@Injectable()
export class OrdersExportService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async export(
    business: Business,
    format: ExportFormat,
    filters: { status?: string; from?: string; to?: string },
    limit: number,
  ): Promise<ReportExport> {
    const conditions: SQL[] = [eq(schema.orders.businessId, business.id)];

    if (filters.status) {
      conditions.push(eq(schema.orders.status, filters.status));
    }

    if (filters.from) {
      conditions.push(gte(schema.orders.createdAt, new Date(filters.from)));
    }

    if (filters.to) {
      conditions.push(lte(schema.orders.createdAt, new Date(filters.to)));
    }

    const lines = await this.db
      .select({
        createdAt: schema.orders.createdAt,
        orderStatus: schema.orders.status,
        source: schema.orders.source,
        channel: schema.salesChannels.name,
        productName: schema.orderItems.productName,
        quantity: schema.orderItems.quantity,
        unitPriceCents: schema.orderItems.unitPriceCents,
        discountCents: schema.orderItems.discountCents,
        lineTotalCents: schema.orderItems.lineTotalCents,
        customer: schema.customers.name,
      })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
      .leftJoin(
        schema.salesChannels,
        eq(schema.salesChannels.id, schema.orders.channelId),
      )
      .leftJoin(
        schema.customers,
        eq(schema.customers.id, schema.orders.customerId),
      )
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt))
      .limit(Math.min(limit, MAX_EXPORT_ROWS));

    const rows = lines.map<SoldItemRow>((line) => ({
      date: line.createdAt.toISOString().slice(0, 10),
      orderStatus: line.orderStatus,
      source: line.source,
      channel: line.channel ?? 'direct',
      item: line.productName,
      quantity: Number(line.quantity),
      unitPrice: toRupees(line.unitPriceCents),
      discount: toRupees(line.discountCents),
      lineTotal: toRupees(line.lineTotalCents - line.discountCents),
      customer: line.customer ?? '',
    }));

    return buildReport(format, `sales-${business.id.slice(0, 8)}`, {
      sheetName: 'Sales',
      title: `${business.legalName} — items sold`,
      subtitle: [
        `${rows.length} line(s)`,
        new Date().toISOString().slice(0, 10),
      ],
      columns: COLUMNS,
      rows,
      totalColumns: ['quantity', 'discount', 'lineTotal'],
    });
  }
}

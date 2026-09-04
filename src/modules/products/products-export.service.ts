import { Injectable } from '@nestjs/common';
import {
  buildReport,
  MAX_EXPORT_ROWS,
  type ExportFormat,
  type ReportColumn,
  type ReportExport,
  toRupees,
} from '../../common/reporting';
import type { Business, MedicalProductData } from '../../database/schema';
import { describePackStock } from './pack-pricing';
import { ProductsRepository } from './products.repository';

export interface ProductExportRow {
  name: string;
  sku: string;
  unitType: string;
  unitsPerPack: number;
  genericName: string;
  rackLocation: string;
  price: number;
  costPrice: number;
  margin: number;
  stockQty: number;
  packs: number;
  loose: number;
  lowStockThreshold: number;
  isActive: string;
}

const COLUMNS: ReportColumn<ProductExportRow>[] = [
  { header: 'Name', key: 'name', width: 32 },
  { header: 'SKU', key: 'sku', width: 16 },
  { header: 'Unit', key: 'unitType', width: 10 },
  { header: 'Units per pack', key: 'unitsPerPack', width: 14 },
  { header: 'Generic name', key: 'genericName', width: 22 },
  { header: 'Rack', key: 'rackLocation', width: 10 },
  { header: 'Price', key: 'price', width: 12 },
  { header: 'Cost price', key: 'costPrice', width: 12 },
  { header: 'Margin', key: 'margin', width: 12 },
  { header: 'Stock', key: 'stockQty', width: 12 },
  { header: 'Packs', key: 'packs', width: 10 },
  { header: 'Loose', key: 'loose', width: 10 },
  { header: 'Low stock at', key: 'lowStockThreshold', width: 14 },
  { header: 'Active', key: 'isActive', width: 8 },
];

@Injectable()
export class ProductsExportService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async export(
    business: Business,
    format: ExportFormat,
    search: string | undefined,
    limit: number,
  ): Promise<ReportExport> {
    const products = await this.productsRepository.findMany({
      businessId: business.id,
      limit: Math.min(limit, MAX_EXPORT_ROWS),
      offset: 0,
      sortBy: 'name',
      sortDirection: 'asc',
      ...(search ? { search } : {}),
    });

    const rows = products.map<ProductExportRow>((product) => {
      const sectorData = product.sectorData as MedicalProductData | null;
      const stockQty = Number(product.stockQty);
      const held = describePackStock(stockQty, product.unitsPerPack);

      return {
        name: product.name,
        sku: product.sku ?? '',
        unitType: product.unitType,
        unitsPerPack: product.unitsPerPack,
        genericName: sectorData?.genericName ?? '',
        rackLocation: sectorData?.rackLocation ?? '',
        price: toRupees(product.priceCents),
        costPrice: toRupees(product.costPriceCents),
        margin: toRupees(product.priceCents - product.costPriceCents),
        stockQty,
        packs: held.packs,
        loose: held.loose,
        lowStockThreshold: Number(product.lowStockThreshold),
        isActive: product.isActive ? 'yes' : 'no',
      };
    });

    return buildReport(format, `products-${business.id.slice(0, 8)}`, {
      sheetName: 'Products',
      title: `${business.legalName} — products`,
      subtitle: [
        `${rows.length} item(s)`,
        new Date().toISOString().slice(0, 10),
      ],
      columns: COLUMNS,
      rows,
      totalColumns: ['stockQty'],
    });
  }
}

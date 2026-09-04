import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, Sector } from '../../database/schema';
import {
  DRUG_SCHEDULES,
  MEDICAL_UNIT_TYPES,
  UNIT_TYPES,
} from '../../database/schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type {
  ImportProductsDto,
  ProductImportRowDto,
} from './dto/product-import.dto';

const QUANTITY_SCALE = 3;

export type ImportOutcome = 'created' | 'updated' | 'skipped' | 'failed';

export interface ImportRowResult {
  rowNumber: number;
  sku: string | null;
  name: string;
  outcome: ImportOutcome;
  reason?: string;
}

export interface ImportSummary {
  dryRun: boolean;
  created: number;
  updated: number;
  failed: number;
  results: ImportRowResult[];
}

@Injectable()
export class ProductsImportService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly entitlements: EntitlementsService,
  ) {}

  async import(
    business: Business,
    dto: ImportProductsDto,
  ): Promise<ImportSummary> {
    const dryRun = dto.dryRun ?? false;
    const results: ImportRowResult[] = [];

    const skus = dto.rows
      .map((row) => row.sku?.trim())
      .filter((sku): sku is string => Boolean(sku));

    const existing =
      skus.length > 0
        ? await this.db
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.businessId, business.id),
                inArray(schema.products.sku, skus),
              ),
            )
        : [];

    const bySku = new Map(
      existing
        .filter((product) => product.sku !== null)
        .map((product) => [product.sku as string, product]),
    );

    // A row with no SKU has no key, so re-importing an export would duplicate
    // every product that lacks one. Name is the fallback: two products with
    // the same name in one catalogue is already a data problem, and a silent
    // duplicate is the worse outcome.
    const names = dto.rows.map((row) => row.name.trim());

    const byName = new Map(
      (names.length > 0
        ? await this.db
            .select()
            .from(schema.products)
            .where(
              and(
                eq(schema.products.businessId, business.id),
                inArray(schema.products.name, names),
              ),
            )
        : []
      ).map((product) => [product.name, product]),
    );

    // A SKU repeated inside one file would otherwise create then update the
    // same product, and the file's own last row would silently win.
    const seen = new Set<string>();

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const row of dto.rows) {
      const sku = row.sku?.trim() || null;
      const problem = this.validate(business.sector as Sector, row, sku, seen);

      if (problem) {
        failed += 1;
        results.push({
          rowNumber: row.rowNumber,
          sku,
          name: row.name,
          outcome: 'failed',
          reason: problem,
        });
        continue;
      }

      if (sku) {
        seen.add(sku);
      }

      const match = sku ? bySku.get(sku) : byName.get(row.name.trim());

      if (match) {
        updated += 1;

        if (!dryRun) {
          await this.db
            .update(schema.products)
            .set(this.patchFor(row, match.sectorData))
            .where(eq(schema.products.id, match.id));
        }

        results.push({
          rowNumber: row.rowNumber,
          sku,
          name: row.name,
          outcome: 'updated',
        });
        continue;
      }

      created += 1;

      if (!dryRun) {
        await this.db.insert(schema.products).values({
          id: randomUUID(),
          businessId: business.id,
          name: row.name,
          sku,
          unitType: row.unitType ?? 'pcs',
          unitsPerPack: row.unitsPerPack ?? 1,
          subUnitLabel: row.subUnitLabel ?? null,
          priceCents: row.priceCents,
          costPriceCents: row.costPriceCents ?? 0,
          stockQty: (row.stockQty ?? 0).toFixed(QUANTITY_SCALE),
          lowStockThreshold: (row.lowStockThreshold ?? 0).toFixed(
            QUANTITY_SCALE,
          ),
          sectorData: this.sectorDataFor(row, {}),
          isActive: true,
        });
      }

      results.push({
        rowNumber: row.rowNumber,
        sku,
        name: row.name,
        outcome: 'created',
      });
    }

    if (!dryRun && created > 0) {
      // Checked after the fact rather than per row: the limit is on the
      // catalogue as a whole, and failing halfway would leave a partial import.
      const total = await this.db.$count(
        schema.products,
        eq(schema.products.businessId, business.id),
      );

      await this.entitlements.assertWithinLimit(
        business.id,
        'maxProducts',
        total - 1,
      );
    }

    return { dryRun, created, updated, failed, results };
  }

  private validate(
    sector: Sector,
    row: ProductImportRowDto,
    sku: string | null,
    seen: Set<string>,
  ): string | null {
    if (sku && seen.has(sku)) {
      return `SKU ${sku} appears more than once in this file`;
    }

    const allowedUnits: readonly string[] =
      sector === 'medical' ? MEDICAL_UNIT_TYPES : UNIT_TYPES;

    if (row.unitType && !allowedUnits.includes(row.unitType)) {
      return `unitType must be one of: ${allowedUnits.join(', ')}`;
    }

    if (
      row.schedule &&
      !(DRUG_SCHEDULES as readonly string[]).includes(row.schedule)
    ) {
      return `schedule must be one of: ${DRUG_SCHEDULES.join(', ')}`;
    }

    if (
      row.costPriceCents !== undefined &&
      row.costPriceCents > row.priceCents
    ) {
      return 'cost price is higher than the selling price';
    }

    return null;
  }

  private patchFor(
    row: ProductImportRowDto,
    current: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      name: row.name,
      priceCents: row.priceCents,
      ...(row.unitType !== undefined && { unitType: row.unitType }),
      ...(row.subUnitLabel !== undefined && {
        subUnitLabel: row.subUnitLabel,
      }),
      ...(row.costPriceCents !== undefined && {
        costPriceCents: row.costPriceCents,
      }),
      ...(row.lowStockThreshold !== undefined && {
        lowStockThreshold: row.lowStockThreshold.toFixed(QUANTITY_SCALE),
      }),
      sectorData: this.sectorDataFor(row, current),
    };
  }

  /**
   * Stock is deliberately not updated on an existing product: an import is a
   * catalogue, and overwriting a counted quantity with a stale spreadsheet
   * figure would silently undo a stock take. Use a stock take for that.
   */
  private sectorDataFor(
    row: ProductImportRowDto,
    current: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      ...current,
      ...(row.genericName !== undefined && { genericName: row.genericName }),
      ...(row.rackLocation !== undefined && {
        rackLocation: row.rackLocation,
      }),
      ...(row.schedule !== undefined && { schedule: row.schedule }),
      ...(row.barcode !== undefined && { barcode: row.barcode }),
    };
  }
}

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { Business, Product, Sector } from '../../database/schema';
import {
  DRUG_SCHEDULES,
  MEDICAL_UNIT_TYPES,
  UNIT_TYPES,
} from '../../database/schema';
import { EntitlementsService } from '../entitlements/entitlements.service';
import type {
  CreateProductDto,
  UpdateProductDto,
} from './dto/product-request.dto';
import {
  type ListProductsFilters,
  ProductsRepository,
} from './products.repository';

const QUANTITY_SCALE = 3;

function toNumericText(value: number): string {
  return value.toFixed(QUANTITY_SCALE);
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly productsRepository: ProductsRepository,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getById(businessId: string, id: string): Promise<Product> {
    const found = await this.productsRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return found;
  }

  async list(filters: ListProductsFilters): Promise<PaginatedResult<Product>> {
    const [data, total] = await Promise.all([
      this.productsRepository.findMany(filters),
      this.productsRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async create(business: Business, dto: CreateProductDto): Promise<Product> {
    this.validateForSector(business.sector as Sector, dto);

    if (dto.sku) {
      await this.assertSkuAvailable(business.id, dto.sku);
    }

    const current = await this.productsRepository.countForBusiness(business.id);
    await this.entitlementsService.assertWithinLimit(
      business.id,
      'maxProducts',
      current,
    );

    return this.productsRepository.insert({
      id: randomUUID(),
      businessId: business.id,
      name: dto.name,
      sku: dto.sku ?? null,
      unitType: dto.unitType ?? 'pcs',
      unitsPerPack: dto.unitsPerPack ?? 1,
      subUnitLabel: dto.subUnitLabel ?? null,
      priceCents: dto.priceCents,
      stockQty: toNumericText(dto.stockQty ?? 0),
      lowStockThreshold: toNumericText(dto.lowStockThreshold ?? 0),
      isActive: true,
      sectorData: dto.sectorData ?? {},
    });
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateProductDto,
  ): Promise<Product> {
    const existing = await this.getById(business.id, id);

    this.validateForSector(business.sector as Sector, dto);

    if (dto.sku && dto.sku !== existing.sku) {
      await this.assertSkuAvailable(business.id, dto.sku);
    }

    const repacking =
      dto.unitsPerPack !== undefined &&
      dto.unitsPerPack !== existing.unitsPerPack;

    if (repacking) {
      await this.repack(business.id, existing, dto.unitsPerPack as number);
    }

    const updated = await this.productsRepository.update(business.id, id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.unitType !== undefined && { unitType: dto.unitType }),
      ...(dto.unitsPerPack !== undefined && {
        unitsPerPack: dto.unitsPerPack,
      }),
      ...(dto.subUnitLabel !== undefined && {
        subUnitLabel: dto.subUnitLabel,
      }),
      ...(dto.priceCents !== undefined && { priceCents: dto.priceCents }),
      ...(dto.lowStockThreshold !== undefined && {
        lowStockThreshold: toNumericText(dto.lowStockThreshold),
      }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      ...(dto.sectorData !== undefined && { sectorData: dto.sectorData }),
    });

    if (!updated) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return updated;
  }

  async deactivate(businessId: string, id: string): Promise<Product> {
    const updated = await this.productsRepository.update(businessId, id, {
      isActive: false,
    });

    if (!updated) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return updated;
  }

  private async assertSkuAvailable(
    businessId: string,
    sku: string,
  ): Promise<void> {
    const existing = await this.productsRepository.findBySku(businessId, sku);

    if (existing) {
      throw new ConflictException(
        `SKU ${sku} already exists for this business`,
      );
    }
  }

  private async repack(
    businessId: string,
    existing: Product,
    unitsPerPack: number,
  ): Promise<void> {
    const ratio = unitsPerPack / existing.unitsPerPack;

    const held = await this.db
      .select({ qty: schema.productBatches.qty })
      .from(schema.productBatches)
      .where(eq(schema.productBatches.productId, existing.id));

    const quantities = [
      Number(existing.stockQty),
      ...held.map((row) => Number(row.qty)),
    ];

    const lossy = quantities.some((quantity) => {
      const scaled = quantity * ratio;
      return Math.abs(scaled - Math.round(scaled)) > 1e-6;
    });

    if (lossy) {
      throw new BadRequestException({
        message: 'i18n:errors.product.repackNotExact',
        unitsPerPack,
      });
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.products)
        .set({
          stockQty: sql`round(${schema.products.stockQty} * ${ratio}, 3)`,
          lowStockThreshold: sql`round(${schema.products.lowStockThreshold} * ${ratio}, 3)`,
        })
        .where(eq(schema.products.id, existing.id));

      await tx
        .update(schema.productBranchStock)
        .set({
          stockQty: sql`round(${schema.productBranchStock.stockQty} * ${ratio}, 3)`,
        })
        .where(eq(schema.productBranchStock.productId, existing.id));

      await tx
        .update(schema.productBatches)
        .set({ qty: sql`round(${schema.productBatches.qty} * ${ratio}, 3)` })
        .where(eq(schema.productBatches.productId, existing.id));
    });
  }

  private validateForSector(
    sector: Sector,
    dto: CreateProductDto | UpdateProductDto,
  ): void {
    const allowedUnits =
      sector === 'medical'
        ? (MEDICAL_UNIT_TYPES as readonly string[])
        : (UNIT_TYPES as readonly string[]);

    if (dto.unitType && !allowedUnits.includes(dto.unitType)) {
      throw new BadRequestException(
        `unitType for the ${sector} sector must be one of: ${allowedUnits.join(', ')}`,
      );
    }

    if (sector === 'mart') {
      const barcode = dto.sectorData?.barcode;

      if (barcode !== undefined && typeof barcode !== 'string') {
        throw new BadRequestException('sectorData.barcode must be a string');
      }
      return;
    }

    if (sector === 'medical') {
      const schedule = dto.sectorData?.schedule;

      if (
        schedule !== undefined &&
        !DRUG_SCHEDULES.includes(schedule as never)
      ) {
        throw new BadRequestException(
          `sectorData.schedule must be one of: ${DRUG_SCHEDULES.join(', ')}`,
        );
      }
    }
  }
}

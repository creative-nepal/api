import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
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

    const updated = await this.productsRepository.update(business.id, id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.sku !== undefined && { sku: dto.sku }),
      ...(dto.unitType !== undefined && { unitType: dto.unitType }),
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

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Database, InjectDatabase } from '../../database';
import type { Business, ProductBatch } from '../../database/schema';
import { ProductsService } from '../products/products.service';
import { BatchesRepository } from './batches.repository';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type {
  CreateBatchDto,
  ExpiringBatchesQueryDto,
  UpdateBatchDto,
} from './dto/batch-request.dto';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class BatchesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly batchesRepository: BatchesRepository,
    private readonly productsService: ProductsService,
  ) {}

  async list(businessId: string, productId: string): Promise<ProductBatch[]> {
    await this.productsService.getById(businessId, productId);
    return this.batchesRepository.findByProduct(businessId, productId);
  }

  async getById(businessId: string, id: string): Promise<ProductBatch> {
    const found = await this.batchesRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException(`Batch ${id} not found`);
    }

    return found;
  }

  async listExpiring(
    businessId: string,
    query: ExpiringBatchesQueryDto,
  ): Promise<PaginatedResult<ProductBatch>> {
    const today = new Date();
    const until = new Date(today.getTime() + query.withinDays * 86_400_000);

    const { data, total } = await this.batchesRepository.findExpiring(
      businessId,
      toDateOnly(today),
      toDateOnly(until),
      query,
    );

    return { data, total, limit: query.limit, offset: query.offset };
  }

  async create(
    business: Business,
    productId: string,
    dto: CreateBatchDto,
  ): Promise<ProductBatch> {
    await this.productsService.getById(business.id, productId);

    const existing = await this.batchesRepository.findByBatchNo(
      business.id,
      productId,
      dto.batchNo,
    );

    if (existing) {
      throw new ConflictException(
        `Batch ${dto.batchNo} already exists for this product`,
      );
    }

    if (new Date(`${dto.expiryDate}T00:00:00Z`) <= new Date()) {
      throw new BadRequestException(
        'Cannot stock a batch that has already expired',
      );
    }

    return this.db.transaction(async (tx) => {
      const batch = await this.batchesRepository.insert(tx, {
        id: randomUUID(),
        businessId: business.id,
        productId,
        batchNo: dto.batchNo,
        expiryDate: dto.expiryDate,
        qty: dto.qty.toFixed(3),
        costPriceCents: dto.costPriceCents ?? 0,
        isActive: true,
      });

      await this.batchesRepository.syncProductStock(tx, business.id, productId);

      return batch;
    });
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateBatchDto,
  ): Promise<ProductBatch> {
    const existing = await this.getById(businessId, id);

    const updated = await this.batchesRepository.update(businessId, id, dto);

    if (!updated) {
      throw new NotFoundException(`Batch ${id} not found`);
    }

    await this.db.transaction(async (tx) => {
      await this.batchesRepository.syncProductStock(
        tx,
        businessId,
        existing.productId,
      );
    });

    return updated;
  }
}

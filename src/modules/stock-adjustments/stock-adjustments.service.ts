import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase } from '../../database';
import type { Business, StockAdjustment } from '../../database/schema';
import { BatchesRepository } from '../batches/batches.repository';
import { BatchesService } from '../batches/batches.service';
import { ProductsRepository } from '../products/products.repository';
import { ProductsService } from '../products/products.service';
import type { CreateStockAdjustmentDto } from './dto/stock-adjustment.dto';
import {
  type ListStockAdjustmentsFilters,
  StockAdjustmentsRepository,
} from './stock-adjustments.repository';

const QUANTITY_SCALE = 3;

@Injectable()
export class StockAdjustmentsService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly stockAdjustmentsRepository: StockAdjustmentsRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly productsService: ProductsService,
    private readonly batchesRepository: BatchesRepository,
    private readonly batchesService: BatchesService,
  ) {}

  async list(
    filters: ListStockAdjustmentsFilters,
  ): Promise<PaginatedResult<StockAdjustment>> {
    const [data, total] = await Promise.all([
      this.stockAdjustmentsRepository.findMany(filters),
      this.stockAdjustmentsRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async create(
    business: Business,
    dto: CreateStockAdjustmentDto,
    actorUserId: string,
  ): Promise<StockAdjustment> {
    if (dto.delta === 0) {
      throw new BadRequestException('delta must not be zero');
    }

    const product = await this.productsService.getById(
      business.id,
      dto.productId,
    );

    const isBatchTracked = business.sector === 'medical';

    if (isBatchTracked && !dto.batchId) {
      throw new BadRequestException('i18n:errors.stock.batchRequired');
    }

    if (!isBatchTracked && dto.batchId) {
      throw new BadRequestException(
        `batchId is not applicable to the ${business.sector} sector`,
      );
    }

    if (dto.batchId) {
      const batch = await this.batchesService.getById(business.id, dto.batchId);

      if (batch.productId !== product.id) {
        throw new BadRequestException(
          `Batch ${dto.batchId} does not belong to product ${product.id}`,
        );
      }
    }

    const deltaText = dto.delta.toFixed(QUANTITY_SCALE);

    return this.db.transaction(async (tx) => {
      if (dto.batchId) {
        await this.batchesRepository.adjustQty(
          tx,
          business.id,
          dto.batchId,
          deltaText,
        );
        await this.batchesRepository.syncProductStock(
          tx,
          business.id,
          product.id,
        );
      } else {
        await this.productsRepository.adjustStockQty(
          tx,
          business.id,
          product.id,
          deltaText,
        );
      }

      return this.stockAdjustmentsRepository.insert(tx, {
        id: randomUUID(),
        businessId: business.id,
        productId: product.id,
        batchId: dto.batchId ?? null,
        delta: deltaText,
        reason: dto.reason,
        note: dto.note ?? null,
        actorUserId,
      });
    });
  }
}

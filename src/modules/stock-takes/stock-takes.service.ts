import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase } from '../../database';
import type {
  Business,
  NewStockTakeLine,
  StockTake,
  StockTakeLine,
} from '../../database/schema';
import { StockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service';
import type {
  CompleteStockTakeDto,
  OpenStockTakeDto,
  RecordCountsDto,
} from './dto/stock-take-request.dto';
import {
  type ListStockTakesFilters,
  StockTakesRepository,
} from './stock-takes.repository';

const QUANTITY_SCALE = 3;

export interface StockTakeDetail {
  stockTake: StockTake;
  lines: StockTakeLine[];
}

export interface StockTakeOutcome {
  stockTake: StockTake;
  appliedLines: number;
  netVariance: number;
}

@Injectable()
export class StockTakesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly stockTakesRepository: StockTakesRepository,
    private readonly stockAdjustments: StockAdjustmentsService,
  ) {}

  async list(
    filters: ListStockTakesFilters,
  ): Promise<PaginatedResult<StockTake>> {
    const [data, total] = await Promise.all([
      this.stockTakesRepository.findMany(filters),
      this.stockTakesRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async getById(businessId: string, id: string): Promise<StockTakeDetail> {
    const stockTake = await this.requireStockTake(businessId, id);
    const lines = await this.stockTakesRepository.findLines(businessId, id);

    return { stockTake, lines };
  }

  async open(
    business: Business,
    branchId: string,
    dto: OpenStockTakeDto,
    actorUserId: string,
  ): Promise<StockTakeDetail> {
    const alreadyOpen = await this.stockTakesRepository.findOpenForBranch(
      business.id,
      branchId,
    );

    if (alreadyOpen) {
      throw new ConflictException({
        message: 'i18n:errors.stockTake.alreadyOpen',
        reference: alreadyOpen.reference,
      });
    }

    const snapshot =
      business.sector === 'medical'
        ? await this.stockTakesRepository.snapshotBatches(
            business.id,
            dto.productIds,
          )
        : await this.stockTakesRepository.snapshotProducts(
            business.id,
            branchId,
            dto.productIds,
          );

    if (snapshot.length === 0) {
      throw new BadRequestException('i18n:errors.stockTake.nothingToCount');
    }

    return this.db.transaction(async (tx) => {
      const stockTake = await this.stockTakesRepository.insert(tx, {
        id: randomUUID(),
        businessId: business.id,
        branchId,
        reference: dto.reference,
        status: 'open',
        note: dto.note ?? null,
        startedByUserId: actorUserId,
      });

      const lines = await this.stockTakesRepository.insertLines(
        tx,
        snapshot.map<NewStockTakeLine>((row) => ({
          id: randomUUID(),
          businessId: business.id,
          stockTakeId: stockTake.id,
          productId: row.productId,
          batchId: row.batchId,
          productName: row.productName,
          batchNo: row.batchNo,
          systemQty: row.systemQty,
        })),
      );

      return { stockTake, lines };
    });
  }

  async recordCounts(
    businessId: string,
    id: string,
    dto: RecordCountsDto,
    actorUserId: string,
  ): Promise<StockTakeDetail> {
    const stockTake = await this.requireOpen(businessId, id);

    const requested = dto.lines.map((line) => line.lineId);

    if (new Set(requested).size !== requested.length) {
      throw new BadRequestException('i18n:errors.stockTake.duplicateLine');
    }

    const known = await this.stockTakesRepository.findLinesByIds(
      businessId,
      id,
      requested,
    );

    if (known.length !== requested.length) {
      throw new NotFoundException('i18n:errors.stockTake.lineNotFound');
    }

    await this.db.transaction(async (tx) => {
      for (const line of dto.lines) {
        await this.stockTakesRepository.recordCount(
          tx,
          businessId,
          line.lineId,
          line.countedQty.toFixed(QUANTITY_SCALE),
          actorUserId,
        );
      }
    });

    return this.getById(businessId, stockTake.id);
  }

  async complete(
    business: Business,
    branchId: string,
    id: string,
    dto: CompleteStockTakeDto,
    actorUserId: string,
  ): Promise<StockTakeOutcome> {
    await this.requireOpen(business.id, id);

    const uncounted = await this.stockTakesRepository.countUncounted(
      business.id,
      id,
    );

    if (uncounted > 0) {
      throw new BadRequestException({
        message: 'i18n:errors.stockTake.uncountedLines',
        uncounted,
      });
    }

    const lines = await this.stockTakesRepository.findLines(business.id, id);

    let appliedLines = 0;
    let netVariance = 0;

    for (const line of lines) {
      const delta = Number(line.countedQty) - Number(line.systemQty);

      if (delta === 0) {
        continue;
      }

      await this.stockAdjustments.create(
        business,
        branchId,
        {
          productId: line.productId,
          batchId: line.batchId ?? undefined,
          delta,
          reason: 'recount',
          note: `Stock take ${id}`,
        },
        actorUserId,
      );

      appliedLines += 1;
      netVariance += delta;
    }

    const stockTake = await this.stockTakesRepository.close(
      this.db,
      business.id,
      id,
      'completed',
      actorUserId,
      dto.note ?? null,
    );

    if (!stockTake) {
      throw new ConflictException('i18n:errors.stockTake.notOpen');
    }

    return { stockTake, appliedLines, netVariance };
  }

  async cancel(
    businessId: string,
    id: string,
    actorUserId: string,
  ): Promise<StockTake> {
    await this.requireOpen(businessId, id);

    const stockTake = await this.stockTakesRepository.close(
      this.db,
      businessId,
      id,
      'cancelled',
      actorUserId,
      null,
    );

    if (!stockTake) {
      throw new ConflictException('i18n:errors.stockTake.notOpen');
    }

    return stockTake;
  }

  private async requireStockTake(
    businessId: string,
    id: string,
  ): Promise<StockTake> {
    const found = await this.stockTakesRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.stockTake.notFound',
        stockTakeId: id,
      });
    }

    return found;
  }

  private async requireOpen(
    businessId: string,
    id: string,
  ): Promise<StockTake> {
    const stockTake = await this.requireStockTake(businessId, id);

    if (stockTake.status !== 'open') {
      throw new ConflictException('i18n:errors.stockTake.notOpen');
    }

    return stockTake;
  }
}

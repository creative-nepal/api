import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase } from '../../../../database';
import type { Business, RestaurantTable } from '../../../../database/schema';
import type { CreateTableDto, UpdateTableDto } from './dto/table.dto';
import { type ListTablesFilters, TablesRepository } from './tables.repository';

@Injectable()
export class TablesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly tablesRepository: TablesRepository,
  ) {}

  async getById(businessId: string, id: string): Promise<RestaurantTable> {
    const found = await this.tablesRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException(`Table ${id} not found`);
    }

    return found;
  }

  async list(
    filters: ListTablesFilters,
  ): Promise<PaginatedResult<RestaurantTable>> {
    const [data, total] = await Promise.all([
      this.tablesRepository.findMany(filters),
      this.tablesRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async create(
    business: Business,
    branchId: string,
    dto: CreateTableDto,
  ): Promise<RestaurantTable> {
    this.assertRestaurant(business);

    const existing = await this.tablesRepository.findByTableNo(
      business.id,
      dto.tableNo,
    );

    if (existing) {
      throw new ConflictException(`Table ${dto.tableNo} already exists`);
    }

    return this.tablesRepository.insert({
      id: randomUUID(),
      businessId: business.id,
      branchId,
      tableNo: dto.tableNo,
      seats: dto.seats ?? 4,
      status: 'empty',
    });
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateTableDto,
  ): Promise<RestaurantTable> {
    this.assertRestaurant(business);
    await this.getById(business.id, id);

    if (dto.tableNo) {
      const clash = await this.tablesRepository.findByTableNo(
        business.id,
        dto.tableNo,
      );

      if (clash && clash.id !== id) {
        throw new ConflictException(`Table ${dto.tableNo} already exists`);
      }
    }

    const updated = await this.tablesRepository.update(
      this.db,
      business.id,
      id,
      dto,
    );

    if (!updated) {
      throw new NotFoundException(`Table ${id} not found`);
    }

    return updated;
  }

  private assertRestaurant(business: Business): void {
    if (business.sector !== 'restaurant') {
      throw new BadRequestException({
        message: 'i18n:errors.business.tablesRestaurantOnly',
        actual: `i18n:common.sector.${business.sector}`,
      });
    }
  }
}

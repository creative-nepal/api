import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type { Business, TableArea } from '../../../../database/schema';
import type {
  CreateTableAreaDto,
  UpdateTableAreaDto,
} from './dto/table-area.dto';
import {
  type ListTableAreasFilters,
  TableAreasRepository,
} from './table-areas.repository';

export interface TableAreaWithCount {
  area: TableArea;
  tableCount: number;
}

@Injectable()
export class TableAreasService {
  constructor(private readonly tableAreas: TableAreasRepository) {}

  async getById(businessId: string, id: string): Promise<TableArea> {
    const found = await this.tableAreas.findById(businessId, id);

    if (!found) {
      throw new NotFoundException(`Table area ${id} not found`);
    }

    return found;
  }

  async assertBelongsToBranch(
    businessId: string,
    branchId: string,
    areaId: string,
  ): Promise<TableArea> {
    const area = await this.getById(businessId, areaId);

    if (area.branchId !== branchId) {
      throw new BadRequestException(
        `Table area ${area.name} belongs to another branch`,
      );
    }

    if (!area.isActive) {
      throw new BadRequestException(`Table area ${area.name} is archived`);
    }

    return area;
  }

  async list(
    filters: ListTableAreasFilters,
  ): Promise<PaginatedResult<TableAreaWithCount>> {
    const [areas, total] = await Promise.all([
      this.tableAreas.findMany(filters),
      this.tableAreas.countMany(filters),
    ]);

    const counts = await this.tableAreas.countTables(
      areas.map((area) => area.id),
    );

    return {
      data: areas.map((area) => ({
        area,
        tableCount: counts.get(area.id) ?? 0,
      })),
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async create(
    business: Business,
    branchId: string,
    dto: CreateTableAreaDto,
  ): Promise<TableArea> {
    const existing = await this.tableAreas.findByName(branchId, dto.name);

    if (existing) {
      throw new ConflictException(
        `Table area ${dto.name} already exists in this branch`,
      );
    }

    return this.tableAreas.insert({
      id: randomUUID(),
      businessId: business.id,
      branchId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
    });
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateTableAreaDto,
  ): Promise<TableArea> {
    const area = await this.getById(business.id, id);

    if (dto.name && dto.name !== area.name) {
      const clash = await this.tableAreas.findByName(area.branchId, dto.name);

      if (clash) {
        throw new ConflictException(
          `Table area ${dto.name} already exists in this branch`,
        );
      }
    }

    const updated = await this.tableAreas.update(business.id, id, dto);

    if (!updated) {
      throw new NotFoundException(`Table area ${id} not found`);
    }

    return updated;
  }

  async remove(business: Business, id: string): Promise<{ id: string }> {
    const area = await this.getById(business.id, id);
    const counts = await this.tableAreas.countTables([area.id]);
    const inUse = counts.get(area.id) ?? 0;

    if (inUse > 0) {
      throw new ConflictException(
        `Table area ${area.name} still holds ${inUse} table(s); move them first`,
      );
    }

    await this.tableAreas.remove(business.id, id);

    return { id };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Plan } from '../../database/schema';
import type { CreatePlanDto, UpdatePlanDto } from './dto/plan-request.dto';
import { type ListPlansFilters, PlansRepository } from './plans.repository';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  async getById(id: string): Promise<Plan> {
    const found = await this.plansRepository.findById(id);

    if (!found) {
      throw new NotFoundException(`Plan ${id} not found`);
    }

    return found;
  }

  async list(filters: ListPlansFilters): Promise<PaginatedResult<Plan>> {
    const [data, total] = await Promise.all([
      this.plansRepository.findMany(filters),
      this.plansRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const existing = await this.plansRepository.findBySectorAndKey(
      dto.sector,
      dto.key,
    );

    if (existing) {
      throw new ConflictException(
        `Plan ${dto.key} already exists for sector ${dto.sector}`,
      );
    }

    return this.plansRepository.insert({
      id: randomUUID(),
      sector: dto.sector,
      key: dto.key,
      name: dto.name,
      priceCents: dto.priceCents,
      currency: dto.currency ?? 'NPR',
      billingCycle: dto.billingCycle ?? 'monthly',
      featureFlags: dto.featureFlags ?? {},
      isActive: dto.isActive ?? true,
    });
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const updated = await this.plansRepository.update(id, dto);

    if (!updated) {
      throw new NotFoundException(`Plan ${id} not found`);
    }

    return updated;
  }

  async archive(id: string): Promise<Plan> {
    const updated = await this.plansRepository.update(id, { isActive: false });

    if (!updated) {
      throw new NotFoundException(`Plan ${id} not found`);
    }

    return updated;
  }
}

import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Branch } from '../../database/schema';
import { BranchesRepository } from './branches.repository';
import type {
  CreateBranchDto,
  ListBranchesQueryDto,
  UpdateBranchDto,
} from './dto/branches.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly branchesRepository: BranchesRepository) {}

  async list(
    businessId: string,
    query: ListBranchesQueryDto,
  ): Promise<PaginatedResult<Branch>> {
    const { rows, total } = await this.branchesRepository.findMany(
      businessId,
      query.limit,
      query.offset,
      query.isActive,
    );

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  async getById(businessId: string, branchId: string): Promise<Branch> {
    const found = await this.branchesRepository.findById(businessId, branchId);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.branch.notFound',
        branchId,
      });
    }

    return found;
  }

  async resolve(businessId: string, branchId?: string): Promise<Branch> {
    if (branchId) {
      const branch = await this.getById(businessId, branchId);

      if (!branch.isActive) {
        throw new ConflictException({
          message: 'i18n:errors.branch.inactive',
          branchId,
        });
      }

      return branch;
    }

    const fallback = await this.branchesRepository.findDefault(businessId);

    if (!fallback) {
      throw new NotFoundException({
        message: 'i18n:errors.branch.noDefault',
        businessId,
      });
    }

    return fallback;
  }

  async create(businessId: string, dto: CreateBranchDto): Promise<Branch> {
    return this.branchesRepository.insert({
      id: randomUUID(),
      businessId,
      name: dto.name,
      code: dto.code,
      address: dto.address ?? null,
      isDefault: false,
      isActive: true,
    });
  }

  async update(
    businessId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<Branch> {
    const branch = await this.getById(businessId, branchId);

    if (dto.isActive === false && branch.isDefault) {
      throw new ConflictException('i18n:errors.branch.cannotDeactivateDefault');
    }

    const updated = await this.branchesRepository.update(businessId, branchId, {
      ...(dto.name === undefined ? {} : { name: dto.name }),
      ...(dto.address === undefined ? {} : { address: dto.address }),
      ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
    });

    if (!updated) {
      throw new NotFoundException({
        message: 'i18n:errors.branch.notFound',
        branchId,
      });
    }

    return updated;
  }
}

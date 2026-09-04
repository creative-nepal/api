import { Injectable, NotFoundException } from '@nestjs/common';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import type { Business, BusinessStatus } from '../../database/schema';
import {
  BusinessesRepository,
  type ListBusinessesFilters,
} from './businesses.repository';
import { sanitizeTheme } from './theme';

@Injectable()
export class BusinessesService {
  constructor(private readonly businessesRepository: BusinessesRepository) {}

  async getById(id: string): Promise<Business> {
    const found = await this.businessesRepository.findById(id);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.business.notFound',
        businessId: id,
      });
    }

    return found;
  }

  async list(
    filters: ListBusinessesFilters,
  ): Promise<PaginatedResult<Business>> {
    const [data, total] = await Promise.all([
      this.businessesRepository.findMany(filters),
      this.businessesRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async listForUser(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<Business>> {
    const [data, total] = await Promise.all([
      this.businessesRepository.findManyForUser(userId, limit, offset),
      this.businessesRepository.countForUser(userId),
    ]);

    return { data, total, limit, offset };
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Business,
        | 'legalName'
        | 'panNumber'
        | 'vatRegistered'
        | 'cbmsRequired'
        | 'fiscalYearStartMonth'
        | 'serviceChargePercent'
        | 'maxDiscountPercent'
        | 'loyaltyPointsPerHundred'
        | 'loyaltyPointValueCents'
        | 'referralRewardPoints'
        | 'referralWelcomePoints'
        | 'displayName'
      >
    > & { theme?: Record<string, unknown> },
  ): Promise<Business> {
    const { theme, ...rest } = patch;

    const updated = await this.businessesRepository.update(id, {
      ...rest,
      ...(theme === undefined ? {} : { theme: sanitizeTheme(theme) }),
    });

    if (!updated) {
      throw new NotFoundException({
        message: 'i18n:errors.business.notFound',
        businessId: id,
      });
    }

    return updated;
  }

  async setStatus(id: string, status: BusinessStatus): Promise<Business> {
    const updated = await this.businessesRepository.update(id, { status });

    if (!updated) {
      throw new NotFoundException({
        message: 'i18n:errors.business.notFound',
        businessId: id,
      });
    }

    return updated;
  }
}

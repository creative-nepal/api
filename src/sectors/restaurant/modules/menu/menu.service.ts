import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  Business,
  MenuItem,
  MenuModifier,
} from '../../../../database/schema';
import type { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto';
import { type ListMenuFilters, MenuRepository } from './menu.repository';

@Injectable()
export class MenuService {
  constructor(private readonly menuRepository: MenuRepository) {}

  async getById(businessId: string, id: string): Promise<MenuItem> {
    const found = await this.menuRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException(`Menu item ${id} not found`);
    }

    return found;
  }

  async list(filters: ListMenuFilters): Promise<PaginatedResult<MenuItem>> {
    const [data, total] = await Promise.all([
      this.menuRepository.findMany(filters),
      this.menuRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async create(business: Business, dto: CreateMenuItemDto): Promise<MenuItem> {
    this.assertRestaurant(business);
    this.assertModifiersWellFormed(dto.modifiers);

    return this.menuRepository.insert({
      id: randomUUID(),
      businessId: business.id,
      name: dto.name,
      category: dto.category,
      priceCents: dto.priceCents,
      modifiers: dto.modifiers ?? [],
      imageUrl: dto.imageUrl ?? null,
      station: dto.station ?? 'main',
      isAvailable: true,
    });
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    this.assertRestaurant(business);
    this.assertModifiersWellFormed(dto.modifiers);
    await this.getById(business.id, id);

    const updated = await this.menuRepository.update(business.id, id, dto);

    if (!updated) {
      throw new NotFoundException(`Menu item ${id} not found`);
    }

    return updated;
  }

  async setAvailability(
    businessId: string,
    id: string,
    isAvailable: boolean,
  ): Promise<MenuItem> {
    const updated = await this.menuRepository.update(businessId, id, {
      isAvailable,
    });

    if (!updated) {
      throw new NotFoundException(`Menu item ${id} not found`);
    }

    return updated;
  }

  private assertRestaurant(business: Business): void {
    if (business.sector !== 'restaurant') {
      throw new BadRequestException({
        message: 'i18n:errors.business.menuRestaurantOnly',
        actual: `i18n:common.sector.${business.sector}`,
      });
    }
  }

  private assertModifiersWellFormed(modifiers?: MenuModifier[]): void {
    if (!modifiers) {
      return;
    }

    for (const modifier of modifiers) {
      if (typeof modifier?.name !== 'string' || !modifier.name.trim()) {
        throw new BadRequestException('Each modifier needs a name');
      }

      if (!Array.isArray(modifier.options) || modifier.options.length === 0) {
        throw new BadRequestException(
          `Modifier "${modifier.name}" needs at least one option`,
        );
      }

      for (const option of modifier.options) {
        if (typeof option?.label !== 'string' || !option.label.trim()) {
          throw new BadRequestException(
            `Modifier "${modifier.name}" has an option with no label`,
          );
        }

        if (!Number.isInteger(option.priceDeltaCents)) {
          throw new BadRequestException(
            `Option "${option.label}" needs an integer priceDeltaCents`,
          );
        }
      }
    }
  }
}

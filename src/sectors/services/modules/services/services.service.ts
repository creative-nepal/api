import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import type {
  ServiceItem,
  ServiceMembership,
} from '../../../../database/schema';
import { EntitlementsService } from '../../../../modules/entitlements/entitlements.service';
import type {
  CreateMembershipDto,
  CreateServiceItemDto,
  ListMembershipsQueryDto,
  ListServiceItemsQueryDto,
  UpdateServiceItemDto,
} from './dto/services.dto';
import { ServicesRepository } from './services.repository';

@Injectable()
export class ServicesService {
  constructor(
    private readonly servicesRepository: ServicesRepository,
    private readonly entitlements: EntitlementsService,
  ) {}

  async listItems(
    businessId: string,
    query: ListServiceItemsQueryDto,
  ): Promise<PaginatedResult<ServiceItem>> {
    const { rows, total } = await this.servicesRepository.findItems({
      businessId,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      search: query.search,
      category: query.category,
      isActive: query.isActive,
    });

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  async getItem(
    businessId: string,
    serviceItemId: string,
  ): Promise<ServiceItem> {
    const found = await this.servicesRepository.findItemById(
      businessId,
      serviceItemId,
    );

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.services.itemNotFound',
        serviceItemId,
      });
    }

    return found;
  }

  async createItem(
    businessId: string,
    dto: CreateServiceItemDto,
  ): Promise<ServiceItem> {
    const current = await this.servicesRepository.countItems(businessId);
    await this.entitlements.assertWithinLimit(
      businessId,
      'maxProducts',
      current,
    );

    return this.servicesRepository.insertItem({
      id: randomUUID(),
      businessId,
      name: dto.name,
      code: dto.code ?? null,
      category: dto.category ?? null,
      priceCents: dto.priceCents,
      durationMinutes: dto.durationMinutes ?? 30,
      isVatable: dto.isVatable ?? true,
      depositCents: dto.depositCents ?? 0,
      noShowFeeCents: dto.noShowFeeCents ?? 0,
      sessionsPerPackage: dto.sessionsPerPackage ?? null,
      isActive: true,
    });
  }

  async updateItem(
    businessId: string,
    serviceItemId: string,
    dto: UpdateServiceItemDto,
  ): Promise<ServiceItem> {
    await this.getItem(businessId, serviceItemId);

    const updated = await this.servicesRepository.updateItem(
      businessId,
      serviceItemId,
      dto,
    );

    if (!updated) {
      throw new NotFoundException({
        message: 'i18n:errors.services.itemNotFound',
        serviceItemId,
      });
    }

    return updated;
  }

  async listMemberships(
    businessId: string,
    query: ListMembershipsQueryDto,
  ): Promise<PaginatedResult<ServiceMembership>> {
    const { rows, total } = await this.servicesRepository.findMemberships({
      businessId,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      customerId: query.customerId,
      status: query.status,
    });

    return { data: rows, total, limit: query.limit, offset: query.offset };
  }

  async createMembership(
    businessId: string,
    dto: CreateMembershipDto,
  ): Promise<ServiceMembership> {
    await this.getItem(businessId, dto.serviceItemId);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException(
        'i18n:errors.services.membershipExpiryBeforeStart',
      );
    }

    return this.servicesRepository.insertMembership({
      id: randomUUID(),
      businessId,
      serviceItemId: dto.serviceItemId,
      customerId: dto.customerId,
      startsAt,
      expiresAt,
      sessionsTotal: dto.sessionsTotal,
      sessionsUsed: 0,
      status: 'active',
    });
  }
}

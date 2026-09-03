import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { SalesChannel } from '../../../../database/schema';
import type { CreateChannelDto, UpdateChannelDto } from './dto/channel.dto';

@Injectable()
export class ChannelsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async list(
    businessId: string,
    limit: number,
    offset: number,
  ): Promise<PaginatedResult<SalesChannel>> {
    const where = eq(schema.salesChannels.businessId, businessId);

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.salesChannels)
        .where(where)
        .orderBy(asc(schema.salesChannels.name))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ value: count() })
        .from(schema.salesChannels)
        .where(where),
    ]);

    return { data, total: total?.value ?? 0, limit, offset };
  }

  async getById(businessId: string, id: string): Promise<SalesChannel> {
    const [row] = await this.db
      .select()
      .from(schema.salesChannels)
      .where(
        and(
          eq(schema.salesChannels.businessId, businessId),
          eq(schema.salesChannels.id, id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        message: 'i18n:errors.channel.notFound',
        channelId: id,
      });
    }

    return row;
  }

  async create(
    businessId: string,
    dto: CreateChannelDto,
  ): Promise<SalesChannel> {
    try {
      const [row] = await this.db
        .insert(schema.salesChannels)
        .values({
          id: randomUUID(),
          businessId,
          name: dto.name,
          commissionPercent: dto.commissionPercent.toFixed(2),
        })
        .returning();
      return row;
    } catch {
      throw new ConflictException({
        message: 'i18n:errors.channel.duplicate',
        name: dto.name,
      });
    }
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateChannelDto,
  ): Promise<SalesChannel> {
    await this.getById(businessId, id);

    const [row] = await this.db
      .update(schema.salesChannels)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.commissionPercent !== undefined && {
          commissionPercent: dto.commissionPercent.toFixed(2),
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      })
      .where(
        and(
          eq(schema.salesChannels.businessId, businessId),
          eq(schema.salesChannels.id, id),
        ),
      )
      .returning();

    return row;
  }
}

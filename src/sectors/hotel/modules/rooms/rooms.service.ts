import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, inArray, type SQL } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, Room, RoomType } from '../../../../database/schema';
import type {
  CreateRoomDto,
  CreateRoomTypeDto,
  ListRoomsQueryDto,
  UpdateRoomDto,
  UpdateRoomTypeDto,
} from './dto/room.dto';

@Injectable()
export class RoomsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async listTypes(businessId: string): Promise<RoomType[]> {
    return this.db
      .select()
      .from(schema.roomTypes)
      .where(eq(schema.roomTypes.businessId, businessId))
      .orderBy(asc(schema.roomTypes.name));
  }

  async getType(businessId: string, id: string): Promise<RoomType> {
    const [row] = await this.db
      .select()
      .from(schema.roomTypes)
      .where(
        and(
          eq(schema.roomTypes.businessId, businessId),
          eq(schema.roomTypes.id, id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Room type ${id} not found`);
    }

    return row;
  }

  async createType(
    business: Business,
    dto: CreateRoomTypeDto,
  ): Promise<RoomType> {
    const [existing] = await this.db
      .select()
      .from(schema.roomTypes)
      .where(
        and(
          eq(schema.roomTypes.businessId, business.id),
          eq(schema.roomTypes.name, dto.name),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`Room type ${dto.name} already exists`);
    }

    const [row] = await this.db
      .insert(schema.roomTypes)
      .values({
        id: randomUUID(),
        businessId: business.id,
        name: dto.name,
        baseRateCents: dto.baseRateCents,
        maxOccupancy: dto.maxOccupancy ?? 2,
        isActive: true,
      })
      .returning();

    return row;
  }

  async updateType(
    business: Business,
    id: string,
    dto: UpdateRoomTypeDto,
  ): Promise<RoomType> {
    await this.getType(business.id, id);

    const [row] = await this.db
      .update(schema.roomTypes)
      .set(dto)
      .where(
        and(
          eq(schema.roomTypes.businessId, business.id),
          eq(schema.roomTypes.id, id),
        ),
      )
      .returning();

    return row;
  }

  async getById(businessId: string, id: string): Promise<Room> {
    const [row] = await this.db
      .select()
      .from(schema.rooms)
      .where(
        and(eq(schema.rooms.businessId, businessId), eq(schema.rooms.id, id)),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Room ${id} not found`);
    }

    return row;
  }

  async list(
    businessId: string,
    branchId: string,
    query: ListRoomsQueryDto,
  ): Promise<PaginatedResult<{ room: Room; roomType: RoomType | null }>> {
    const conditions: SQL[] = [
      eq(schema.rooms.businessId, businessId),
      eq(schema.rooms.branchId, branchId),
    ];

    if (query.status) {
      conditions.push(eq(schema.rooms.status, query.status));
    }

    if (query.roomTypeId) {
      conditions.push(eq(schema.rooms.roomTypeId, query.roomTypeId));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(schema.rooms.isActive, query.isActive));
    }

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.rooms)
        .where(where)
        .orderBy(asc(schema.rooms.roomNo))
        .limit(query.limit)
        .offset(query.offset),
      this.db.select({ value: count() }).from(schema.rooms).where(where),
    ]);

    const types = await this.typesById(
      businessId,
      rows.map((room) => room.roomTypeId),
    );

    return {
      data: rows.map((room) => ({
        room,
        roomType: types.get(room.roomTypeId) ?? null,
      })),
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async typesById(
    businessId: string,
    ids: string[],
  ): Promise<Map<string, RoomType>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select()
      .from(schema.roomTypes)
      .where(
        and(
          eq(schema.roomTypes.businessId, businessId),
          inArray(schema.roomTypes.id, [...new Set(ids)]),
        ),
      );

    return new Map(rows.map((row) => [row.id, row]));
  }

  async create(
    business: Business,
    branchId: string,
    dto: CreateRoomDto,
  ): Promise<Room> {
    this.assertHotel(business);
    await this.getType(business.id, dto.roomTypeId);

    const [existing] = await this.db
      .select()
      .from(schema.rooms)
      .where(
        and(
          eq(schema.rooms.businessId, business.id),
          eq(schema.rooms.roomNo, dto.roomNo),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(`Room ${dto.roomNo} already exists`);
    }

    const [row] = await this.db
      .insert(schema.rooms)
      .values({
        id: randomUUID(),
        businessId: business.id,
        branchId,
        roomTypeId: dto.roomTypeId,
        roomNo: dto.roomNo,
        floor: dto.floor ?? null,
        status: 'vacant_clean',
        isActive: true,
      })
      .returning();

    return row;
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateRoomDto,
  ): Promise<Room> {
    this.assertHotel(business);
    const room = await this.getById(business.id, id);

    if (dto.roomTypeId) {
      await this.getType(business.id, dto.roomTypeId);
    }

    if (dto.roomNo && dto.roomNo !== room.roomNo) {
      const [clash] = await this.db
        .select()
        .from(schema.rooms)
        .where(
          and(
            eq(schema.rooms.businessId, business.id),
            eq(schema.rooms.roomNo, dto.roomNo),
          ),
        )
        .limit(1);

      if (clash) {
        throw new ConflictException(`Room ${dto.roomNo} already exists`);
      }
    }

    if (dto.status && room.status === 'occupied' && dto.status !== 'occupied') {
      throw new BadRequestException(
        `Room ${room.roomNo} has a guest in it; check them out first`,
      );
    }

    const [row] = await this.db
      .update(schema.rooms)
      .set(dto)
      .where(
        and(eq(schema.rooms.businessId, business.id), eq(schema.rooms.id, id)),
      )
      .returning();

    return row;
  }

  private assertHotel(business: Business): void {
    if (business.sector !== 'hotel') {
      throw new BadRequestException({
        message: 'i18n:errors.business.roomsHotelOnly',
        actual: `i18n:common.sector.${business.sector}`,
      });
    }
  }
}

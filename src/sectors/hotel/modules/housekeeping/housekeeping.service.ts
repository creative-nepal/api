import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, eq, type SQL } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, HousekeepingTask } from '../../../../database/schema';
import { RoomsService } from '../rooms/rooms.service';
import type {
  CreateHousekeepingTaskDto,
  ListHousekeepingQueryDto,
  UpdateHousekeepingTaskDto,
} from './dto/housekeeping.dto';

const CLEAN_STATUSES = new Set(['done', 'inspected']);

@Injectable()
export class HousekeepingService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly rooms: RoomsService,
  ) {}

  async list(
    businessId: string,
    query: ListHousekeepingQueryDto,
  ): Promise<PaginatedResult<{ task: HousekeepingTask; roomNo: string }>> {
    const conditions: SQL[] = [
      eq(schema.housekeepingTasks.businessId, businessId),
    ];

    if (query.status) {
      conditions.push(eq(schema.housekeepingTasks.status, query.status));
    }

    if (query.forDate) {
      conditions.push(
        eq(schema.housekeepingTasks.forDate, query.forDate.slice(0, 10)),
      );
    }

    const where = and(...conditions);

    const [rows, [total]] = await Promise.all([
      this.db
        .select({
          task: schema.housekeepingTasks,
          roomNo: schema.rooms.roomNo,
        })
        .from(schema.housekeepingTasks)
        .innerJoin(
          schema.rooms,
          eq(schema.rooms.id, schema.housekeepingTasks.roomId),
        )
        .where(where)
        .orderBy(
          asc(schema.housekeepingTasks.forDate),
          asc(schema.rooms.roomNo),
        )
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.housekeepingTasks)
        .where(where),
    ]);

    return {
      data: rows,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async create(
    business: Business,
    dto: CreateHousekeepingTaskDto,
  ): Promise<HousekeepingTask> {
    await this.rooms.getById(business.id, dto.roomId);

    const forDate = (dto.forDate ?? new Date().toISOString()).slice(0, 10);

    const [row] = await this.db
      .insert(schema.housekeepingTasks)
      .values({
        id: randomUUID(),
        businessId: business.id,
        roomId: dto.roomId,
        forDate,
        status: 'pending',
        note: dto.note ?? null,
      })
      .onConflictDoUpdate({
        target: [
          schema.housekeepingTasks.roomId,
          schema.housekeepingTasks.forDate,
        ],
        set: { note: dto.note ?? null },
      })
      .returning();

    return row;
  }

  async update(
    business: Business,
    id: string,
    dto: UpdateHousekeepingTaskDto,
  ): Promise<HousekeepingTask> {
    const [task] = await this.db
      .select()
      .from(schema.housekeepingTasks)
      .where(
        and(
          eq(schema.housekeepingTasks.businessId, business.id),
          eq(schema.housekeepingTasks.id, id),
        ),
      )
      .limit(1);

    if (!task) {
      throw new NotFoundException(`Housekeeping task ${id} not found`);
    }

    const status = dto.status ?? task.status;

    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(schema.housekeepingTasks)
        .set({
          ...(dto.assignedUserId !== undefined && {
            assignedUserId: dto.assignedUserId,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
          status,
          completedAt: CLEAN_STATUSES.has(status)
            ? (task.completedAt ?? new Date())
            : null,
        })
        .where(
          and(
            eq(schema.housekeepingTasks.businessId, business.id),
            eq(schema.housekeepingTasks.id, id),
          ),
        )
        .returning();

      const room = await this.rooms.getById(business.id, task.roomId);

      if (CLEAN_STATUSES.has(status) && room.status === 'vacant_dirty') {
        await tx
          .update(schema.rooms)
          .set({ status: 'vacant_clean' })
          .where(eq(schema.rooms.id, task.roomId));
      }

      return updated;
    });
  }
}

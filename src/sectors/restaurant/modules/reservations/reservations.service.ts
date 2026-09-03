import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type { Business, Reservation } from '../../../../database/schema';
import { TablesService } from '../tables/tables.service';
import type {
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import {
  type ListReservationsFilters,
  ReservationsRepository,
} from './reservations.repository';

const DEFAULT_DURATION_MINUTES = 90;

const ACTIVE_STATUSES = ['booked', 'seated'];

@Injectable()
export class ReservationsService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly reservationsRepository: ReservationsRepository,
    private readonly tablesService: TablesService,
  ) {}

  async list(
    filters: ListReservationsFilters,
  ): Promise<PaginatedResult<Reservation>> {
    const [data, total] = await Promise.all([
      this.reservationsRepository.findMany(filters),
      this.reservationsRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async getById(businessId: string, id: string): Promise<Reservation> {
    const found = await this.reservationsRepository.findById(businessId, id);

    if (!found) {
      throw new NotFoundException({
        message: 'i18n:errors.reservation.notFound',
        reservationId: id,
      });
    }

    return found;
  }

  async create(
    business: Business,
    branchId: string,
    dto: CreateReservationDto,
    actorUserId: string,
  ): Promise<Reservation> {
    const reservedFor = this.parseWhen(dto.reservedFor);
    const durationMinutes = dto.durationMinutes ?? DEFAULT_DURATION_MINUTES;

    if (dto.tableId) {
      await this.assertTableFree(
        business.id,
        dto.tableId,
        dto.partySize,
        reservedFor,
        durationMinutes,
      );
    }

    return this.reservationsRepository.insert({
      id: randomUUID(),
      businessId: business.id,
      branchId,
      tableId: dto.tableId ?? null,
      customerId: dto.customerId ?? null,
      guestName: dto.guestName,
      guestPhone: dto.guestPhone ?? null,
      partySize: dto.partySize,
      reservedFor,
      durationMinutes,
      status: 'booked',
      note: dto.note ?? null,
      createdByUserId: actorUserId,
    });
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateReservationDto,
  ): Promise<Reservation> {
    const existing = await this.getById(businessId, id);

    if (!ACTIVE_STATUSES.includes(existing.status)) {
      throw new ConflictException('i18n:errors.reservation.notActive');
    }

    const reservedFor = dto.reservedFor
      ? this.parseWhen(dto.reservedFor)
      : existing.reservedFor;
    const durationMinutes = dto.durationMinutes ?? existing.durationMinutes;
    const partySize = dto.partySize ?? existing.partySize;
    const tableId = dto.tableId ?? existing.tableId;

    if (tableId) {
      await this.assertTableFree(
        businessId,
        tableId,
        partySize,
        reservedFor,
        durationMinutes,
        id,
      );
    }

    const updated = await this.reservationsRepository.update(
      this.db,
      businessId,
      id,
      {
        ...(dto.guestName === undefined ? {} : { guestName: dto.guestName }),
        ...(dto.guestPhone === undefined ? {} : { guestPhone: dto.guestPhone }),
        ...(dto.note === undefined ? {} : { note: dto.note }),
        tableId,
        partySize,
        reservedFor,
        durationMinutes,
      },
      ACTIVE_STATUSES,
    );

    if (!updated) {
      throw new ConflictException('i18n:errors.reservation.notActive');
    }

    return updated;
  }

  async seat(
    businessId: string,
    id: string,
    tableId?: string,
  ): Promise<Reservation> {
    const existing = await this.getById(businessId, id);

    if (existing.status !== 'booked') {
      throw new ConflictException('i18n:errors.reservation.notBooked');
    }

    const resolvedTableId = tableId ?? existing.tableId;

    if (!resolvedTableId) {
      throw new BadRequestException('i18n:errors.reservation.tableRequired');
    }

    await this.assertTableFree(
      businessId,
      resolvedTableId,
      existing.partySize,
      existing.reservedFor,
      existing.durationMinutes,
      id,
    );

    return this.db.transaction(async (tx) => {
      const updated = await this.reservationsRepository.update(
        tx,
        businessId,
        id,
        { status: 'seated', tableId: resolvedTableId, seatedAt: new Date() },
        ['booked'],
      );

      if (!updated) {
        throw new ConflictException('i18n:errors.reservation.notBooked');
      }

      await tx
        .update(schema.restaurantTables)
        .set({ status: 'occupied' })
        .where(eq(schema.restaurantTables.id, resolvedTableId));

      return updated;
    });
  }

  async close(
    businessId: string,
    id: string,
    status: 'completed' | 'no_show' | 'cancelled',
  ): Promise<Reservation> {
    const expected = status === 'completed' ? ['seated'] : ACTIVE_STATUSES;

    const updated = await this.reservationsRepository.update(
      this.db,
      businessId,
      id,
      { status, closedAt: new Date() },
      expected,
    );

    if (!updated) {
      const existing = await this.getById(businessId, id);

      throw new ConflictException(
        expected.includes(existing.status)
          ? 'i18n:errors.reservation.notActive'
          : status === 'completed'
            ? 'i18n:errors.reservation.notSeated'
            : 'i18n:errors.reservation.notActive',
      );
    }

    return updated;
  }

  private parseWhen(value: string): Date {
    const when = new Date(value);

    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('i18n:errors.reservation.badTime');
    }

    return when;
  }

  private async assertTableFree(
    businessId: string,
    tableId: string,
    partySize: number,
    reservedFor: Date,
    durationMinutes: number,
    ignoreReservationId?: string,
  ): Promise<void> {
    const table = await this.tablesService.getById(businessId, tableId);

    if (partySize > table.seats) {
      throw new BadRequestException({
        message: 'i18n:errors.reservation.tableTooSmall',
        tableNo: table.tableNo,
        seats: table.seats,
      });
    }

    const endsAt = new Date(reservedFor.getTime() + durationMinutes * 60_000);

    const clash = await this.reservationsRepository.findOverlapping(
      businessId,
      tableId,
      reservedFor,
      endsAt,
      ignoreReservationId,
    );

    if (clash) {
      throw new ConflictException({
        message: 'i18n:errors.reservation.tableTaken',
        tableNo: table.tableNo,
        guestName: clash.guestName,
      });
    }
  }
}

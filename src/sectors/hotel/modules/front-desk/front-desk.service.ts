import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, ne, sql, type SQL } from 'drizzle-orm';
import type { PaginatedResult } from '../../../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../../../database';
import type {
  Business,
  BusinessInvoice,
  FolioPosting,
  HotelReservation,
} from '../../../../database/schema';
import { InvoicesService } from '../../../../modules/invoices/invoices.service';
import { nightsBetween, roomCharge } from '../../folio-arithmetic';
import { RoomsService } from '../rooms/rooms.service';
import type {
  CheckInDto,
  CreateBookingDto,
  ListBookingsQueryDto,
  PostToFolioDto,
} from './dto/booking.dto';

export interface BookingTotals {
  nights: number;
  roomChargeCents: number;
  extrasCents: number;
}

@Injectable()
export class FrontDeskService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly rooms: RoomsService,
    private readonly invoices: InvoicesService,
  ) {}

  async getById(businessId: string, id: string): Promise<HotelReservation> {
    const [row] = await this.db
      .select()
      .from(schema.hotelReservations)
      .where(
        and(
          eq(schema.hotelReservations.businessId, businessId),
          eq(schema.hotelReservations.id, id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    return row;
  }

  async totalsFor(
    businessId: string,
    reservation: HotelReservation,
  ): Promise<BookingTotals> {
    const [row] = await this.db
      .select({
        value: sql<string>`COALESCE(SUM(${schema.folioPostings.amountCents}), 0)`,
      })
      .from(schema.folioPostings)
      .where(
        and(
          eq(schema.folioPostings.businessId, businessId),
          eq(schema.folioPostings.reservationId, reservation.id),
        ),
      );

    const stay = roomCharge(
      reservation.checkInDate,
      reservation.checkOutDate,
      reservation.nightlyRateCents,
    );

    return {
      nights: stay.nights,
      roomChargeCents: stay.roomChargeCents,
      extrasCents: Number(row?.value ?? 0),
    };
  }

  async list(
    businessId: string,
    branchId: string,
    query: ListBookingsQueryDto,
  ): Promise<PaginatedResult<HotelReservation>> {
    const conditions: SQL[] = [
      eq(schema.hotelReservations.businessId, businessId),
      eq(schema.hotelReservations.branchId, branchId),
    ];

    if (query.status) {
      conditions.push(eq(schema.hotelReservations.status, query.status));
    }

    if (query.arrivingOn) {
      conditions.push(
        eq(schema.hotelReservations.checkInDate, query.arrivingOn.slice(0, 10)),
      );
    }

    const where = and(...conditions);

    const [data, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.hotelReservations)
        .where(where)
        .orderBy(
          asc(schema.hotelReservations.checkInDate),
          asc(schema.hotelReservations.guestName),
        )
        .limit(query.limit)
        .offset(query.offset),
      this.db
        .select({ value: count() })
        .from(schema.hotelReservations)
        .where(where),
    ]);

    return {
      data,
      total: total?.value ?? 0,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async book(
    business: Business,
    branchId: string,
    dto: CreateBookingDto,
    actorUserId: string,
  ): Promise<HotelReservation> {
    const nights = nightsBetween(dto.checkInDate, dto.checkOutDate);

    if (nights < 1) {
      throw new BadRequestException(
        'Check-out must be at least one night after check-in',
      );
    }

    const roomType = await this.rooms.getType(business.id, dto.roomTypeId);

    if (dto.roomId) {
      await this.assertRoomFree(
        business.id,
        dto.roomId,
        dto.checkInDate,
        dto.checkOutDate,
        null,
      );
    }

    const [row] = await this.db
      .insert(schema.hotelReservations)
      .values({
        id: randomUUID(),
        businessId: business.id,
        branchId,
        roomId: dto.roomId ?? null,
        roomTypeId: roomType.id,
        customerId: dto.customerId ?? null,
        guestName: dto.guestName,
        guestPhone: dto.guestPhone ?? null,
        guestIdNumber: dto.guestIdNumber ?? null,
        adults: dto.adults ?? 1,
        children: dto.children ?? 0,
        checkInDate: dto.checkInDate.slice(0, 10),
        checkOutDate: dto.checkOutDate.slice(0, 10),
        nightlyRateCents: dto.nightlyRateCents ?? roomType.baseRateCents,
        mealPlan: dto.mealPlan ?? 'room_only',
        status: 'booked',
        note: dto.note ?? null,
        createdByUserId: actorUserId,
      })
      .returning();

    return row;
  }

  async checkIn(
    business: Business,
    id: string,
    dto: CheckInDto,
  ): Promise<HotelReservation> {
    const reservation = await this.getById(business.id, id);

    if (reservation.status !== 'booked') {
      throw new BadRequestException(
        `This booking is ${reservation.status}; only a booked stay can be checked in`,
      );
    }

    const room = await this.rooms.getById(business.id, dto.roomId);

    if (room.status === 'occupied') {
      throw new ConflictException(`Room ${room.roomNo} is already occupied`);
    }

    if (room.status === 'out_of_service') {
      throw new ConflictException(`Room ${room.roomNo} is out of service`);
    }

    await this.assertRoomFree(
      business.id,
      dto.roomId,
      reservation.checkInDate,
      reservation.checkOutDate,
      reservation.id,
    );

    return this.db.transaction(async (tx) => {
      await tx
        .update(schema.rooms)
        .set({ status: 'occupied' })
        .where(eq(schema.rooms.id, dto.roomId));

      const [updated] = await tx
        .update(schema.hotelReservations)
        .set({
          roomId: dto.roomId,
          status: 'checked_in',
          checkedInAt: new Date(),
        })
        .where(
          and(
            eq(schema.hotelReservations.businessId, business.id),
            eq(schema.hotelReservations.id, id),
          ),
        )
        .returning();

      return updated;
    });
  }

  async post(
    business: Business,
    id: string,
    dto: PostToFolioDto,
    actorUserId: string,
  ): Promise<FolioPosting> {
    const reservation = await this.getById(business.id, id);

    if (reservation.status !== 'checked_in') {
      throw new BadRequestException(
        'Charges can only be posted while the guest is checked in',
      );
    }

    const quantity = dto.quantity ?? 1;

    const [row] = await this.db
      .insert(schema.folioPostings)
      .values({
        id: randomUUID(),
        businessId: business.id,
        reservationId: reservation.id,
        source: dto.source,
        description: dto.description,
        quantity,
        unitPriceCents: dto.unitPriceCents,
        amountCents: dto.unitPriceCents * quantity,
        postedForDate: new Date().toISOString().slice(0, 10),
        actorUserId,
      })
      .returning();

    return row;
  }

  async postings(
    businessId: string,
    reservationId: string,
  ): Promise<FolioPosting[]> {
    return this.db
      .select()
      .from(schema.folioPostings)
      .where(
        and(
          eq(schema.folioPostings.businessId, businessId),
          eq(schema.folioPostings.reservationId, reservationId),
        ),
      )
      .orderBy(asc(schema.folioPostings.createdAt));
  }

  async checkOut(
    business: Business,
    id: string,
    actorUserId: string,
  ): Promise<{ reservation: HotelReservation; invoice: BusinessInvoice }> {
    const reservation = await this.getById(business.id, id);

    if (reservation.status !== 'checked_in') {
      throw new BadRequestException(
        `This booking is ${reservation.status}; only a checked-in stay can be checked out`,
      );
    }

    const totals = await this.totalsFor(business.id, reservation);

    return this.db.transaction(async (tx) => {
      const invoice = await this.invoices.issue(tx, {
        business,
        branchId: reservation.branchId,
        orderId: null,
        subtotalCents: totals.roomChargeCents + totals.extrasCents,
        customerId: reservation.customerId,
        customerName: reservation.guestName,
        actorUserId,
      });

      if (reservation.roomId) {
        await tx
          .update(schema.rooms)
          .set({ status: 'vacant_dirty' })
          .where(eq(schema.rooms.id, reservation.roomId));

        await tx
          .insert(schema.housekeepingTasks)
          .values({
            id: randomUUID(),
            businessId: business.id,
            roomId: reservation.roomId,
            forDate: new Date().toISOString().slice(0, 10),
            status: 'pending',
          })
          .onConflictDoNothing();
      }

      const [updated] = await tx
        .update(schema.hotelReservations)
        .set({
          status: 'checked_out',
          checkedOutAt: new Date(),
          invoiceId: invoice.id,
        })
        .where(
          and(
            eq(schema.hotelReservations.businessId, business.id),
            eq(schema.hotelReservations.id, id),
          ),
        )
        .returning();

      return { reservation: updated, invoice };
    });
  }

  async cancel(business: Business, id: string): Promise<HotelReservation> {
    const reservation = await this.getById(business.id, id);

    if (reservation.status !== 'booked') {
      throw new BadRequestException(
        `This booking is ${reservation.status}; only a booked stay can be cancelled`,
      );
    }

    const [row] = await this.db
      .update(schema.hotelReservations)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(schema.hotelReservations.businessId, business.id),
          eq(schema.hotelReservations.id, id),
        ),
      )
      .returning();

    return row;
  }

  private async assertRoomFree(
    businessId: string,
    roomId: string,
    checkInDate: string,
    checkOutDate: string,
    exceptId: string | null,
  ): Promise<void> {
    const conditions: SQL[] = [
      eq(schema.hotelReservations.businessId, businessId),
      eq(schema.hotelReservations.roomId, roomId),
      sql`${schema.hotelReservations.status} IN ('booked', 'checked_in')`,
      sql`${schema.hotelReservations.checkInDate} < ${checkOutDate.slice(0, 10)}::date`,
      sql`${schema.hotelReservations.checkOutDate} > ${checkInDate.slice(0, 10)}::date`,
    ];

    if (exceptId) {
      conditions.push(ne(schema.hotelReservations.id, exceptId));
    }

    const [clash] = await this.db
      .select({
        guestName: schema.hotelReservations.guestName,
        checkInDate: schema.hotelReservations.checkInDate,
        checkOutDate: schema.hotelReservations.checkOutDate,
      })
      .from(schema.hotelReservations)
      .where(and(...conditions))
      .limit(1);

    if (clash) {
      throw new ConflictException({
        message: 'i18n:errors.booking.roomTaken',
        guestName: clash.guestName,
        from: clash.checkInDate,
        to: clash.checkOutDate,
      });
    }
  }
}

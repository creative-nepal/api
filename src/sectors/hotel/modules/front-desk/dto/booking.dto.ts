import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import {
  FOLIO_POSTING_SOURCES,
  type FolioPosting,
  type FolioPostingSource,
  HOTEL_RESERVATION_STATUSES,
  type HotelReservation,
  type HotelReservationStatus,
  MEAL_PLANS,
  type MealPlan,
} from '../../../../../database/schema';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  roomTypeId!: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  guestName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guestIdNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  children?: number;

  @IsISO8601({ strict: true })
  checkInDate!: string;

  @IsISO8601({ strict: true })
  checkOutDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nightlyRateCents?: number;

  @IsOptional()
  @IsIn(MEAL_PLANS)
  mealPlan?: MealPlan;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CheckInDto {
  @IsString()
  @IsNotEmpty()
  roomId!: string;
}

export class PostToFolioDto {
  @IsIn(FOLIO_POSTING_SOURCES)
  source!: FolioPostingSource;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}

export class ListBookingsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(HOTEL_RESERVATION_STATUSES)
  status?: HotelReservationStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  arrivingOn?: string;
}

export class FolioPostingResponseDto {
  id: string;
  source: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
  createdAt: Date;

  constructor(posting: FolioPosting) {
    this.id = posting.id;
    this.source = posting.source;
    this.description = posting.description;
    this.quantity = posting.quantity;
    this.unitPriceCents = posting.unitPriceCents;
    this.amountCents = posting.amountCents;
    this.createdAt = posting.createdAt;
  }
}

export class BookingResponseDto {
  id: string;
  businessId: string;
  roomId: string | null;
  roomNo: string | null;
  roomTypeId: string;
  guestName: string;
  guestPhone: string | null;
  adults: number;
  children: number;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  nightlyRateCents: number;
  roomChargeCents: number;
  extrasCents: number;
  folioTotalCents: number;
  mealPlan: string;
  status: string;
  invoiceId: string | null;
  note: string | null;

  constructor(
    reservation: HotelReservation,
    totals: {
      nights: number;
      roomChargeCents: number;
      extrasCents: number;
    },
    roomNo: string | null = null,
  ) {
    this.id = reservation.id;
    this.businessId = reservation.businessId;
    this.roomId = reservation.roomId;
    this.roomNo = roomNo;
    this.roomTypeId = reservation.roomTypeId;
    this.guestName = reservation.guestName;
    this.guestPhone = reservation.guestPhone;
    this.adults = reservation.adults;
    this.children = reservation.children;
    this.checkInDate = reservation.checkInDate;
    this.checkOutDate = reservation.checkOutDate;
    this.nights = totals.nights;
    this.nightlyRateCents = reservation.nightlyRateCents;
    this.roomChargeCents = totals.roomChargeCents;
    this.extrasCents = totals.extrasCents;
    this.folioTotalCents = totals.roomChargeCents + totals.extrasCents;
    this.mealPlan = reservation.mealPlan;
    this.status = reservation.status;
    this.invoiceId = reservation.invoiceId;
    this.note = reservation.note;
  }
}

import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../../../common/dto/list-query.dto';
import { RESERVATION_STATUSES } from '../../../../../database/schema';
import type { ReservationStatus } from '../../../../../database/schema';

export class CreateReservationDto {
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
  customerId?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  partySize!: number;

  @IsDateString()
  reservedFor!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateReservationDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  partySize?: number;

  @IsOptional()
  @IsDateString()
  reservedFor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(600)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListReservationsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  tableId?: string;
}

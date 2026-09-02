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
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  APPOINTMENT_STATUSES,
  type AppointmentStatus,
} from '../../../database/schema';

export class CreateAppointmentDto {
  @IsString() @IsNotEmpty() serviceItemId!: string;

  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() membershipId?: string;
  @IsOptional() @IsString() staffUserId?: string;

  @IsDateString() scheduledAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1_440)
  durationMinutes?: number;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class UpdateAppointmentStatusDto {
  @IsIn(APPOINTMENT_STATUSES) status!: AppointmentStatus;
}

export class ListAppointmentsQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(APPOINTMENT_STATUSES) status?: AppointmentStatus;
  @IsOptional() @IsString() staffUserId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  CALENDAR_EVENT_KINDS,
  CALENDAR_EVENT_STATUSES,
  CALENDAR_SCOPES,
  RECURRENCE_FREQUENCIES,
} from '../../../database/schema';
import type {
  CalendarEventKind,
  CalendarEventStatus,
  CalendarScope,
  RecurrenceFrequency,
} from '../../../database/schema';

export class RecurrenceDto {
  @IsIn(RECURRENCE_FREQUENCIES) freq!: RecurrenceFrequency;

  @Type(() => Number) @IsInt() @Min(1) @Max(365) interval!: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  byWeekday?: number[];

  @IsOptional() @IsDateString() until?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) count?: number;
}

export class CreateCalendarEventDto {
  @IsIn(CALENDAR_SCOPES) scope!: CalendarScope;

  @IsOptional() @IsIn(CALENDAR_EVENT_KINDS) kind?: CalendarEventKind;

  @IsString() @IsNotEmpty() @MaxLength(255) title!: string;

  @IsOptional() @IsString() @MaxLength(2000) description?: string;

  @IsDateString() startsAt!: string;

  @IsOptional() @IsDateString() endsAt?: string;

  @IsOptional() @IsBoolean() allDay?: boolean;

  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsString() assignedToUserId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40_320)
  remindMinutesBefore?: number;

  @IsOptional() @IsString() @MaxLength(64) linkedType?: string;
  @IsOptional() @IsString() @MaxLength(64) linkedId?: string;
}

export class UpdateCalendarEventDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsString() assignedToUserId?: string;
  @IsOptional() @IsIn(CALENDAR_EVENT_STATUSES) status?: CalendarEventStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40_320)
  remindMinutesBefore?: number;

  @IsOptional() @IsObject() recurrence?: Record<string, unknown> | null;
}

export class CalendarFeedQueryDto {
  @IsDateString() from!: string;
  @IsDateString() to!: string;

  @IsOptional() @IsIn(CALENDAR_SCOPES) scope?: CalendarScope;
  @IsOptional() @IsIn(CALENDAR_EVENT_KINDS) kind?: CalendarEventKind;
}

export class ListCalendarEventsQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(CALENDAR_SCOPES) scope?: CalendarScope;
  @IsOptional() @IsIn(CALENDAR_EVENT_STATUSES) status?: CalendarEventStatus;
}

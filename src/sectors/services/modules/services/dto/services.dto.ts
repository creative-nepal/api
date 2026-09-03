import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../../../common/dto/list-query.dto';

export class CreateServiceItemDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(64) code?: string;
  @IsOptional() @IsString() @MaxLength(128) category?: string;

  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1_440)
  durationMinutes?: number;

  @IsOptional() @IsBoolean() isVatable?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) depositCents?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noShowFeeCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionsPerPackage?: number;
}

export class UpdateServiceItemDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(128) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(1_440)
  durationMinutes?: number;

  @IsOptional() @IsBoolean() isVatable?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) depositCents?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) noShowFeeCents?: number;
}

export class ListServiceItemsQueryDto extends ListQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
}

export class CreateMembershipDto {
  @IsString() @IsNotEmpty() serviceItemId!: string;
  @IsString() @IsNotEmpty() customerId!: string;

  @Type(() => Number) @IsInt() @Min(1) sessionsTotal!: number;

  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class ListMembershipsQueryDto extends ListQueryDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() status?: string;
}

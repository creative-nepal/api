import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_LEASE_SIZE = 50;

export class CreateLeaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LEASE_SIZE)
  size: number = 10;
}

export class ReconcileLeaseDto {
  @IsArray()
  @ArrayMinSize(0)
  @Type(() => Number)
  @IsInt({ each: true })
  usedNumbers!: number[];
}

export class SyncProductsQueryDto {
  @IsOptional()
  @IsDateString()
  updatedSince?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 200;
}

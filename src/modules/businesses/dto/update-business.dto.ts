import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  BUSINESS_STATUSES,
  type BusinessStatus,
} from '../../../database/schema';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  panNumber?: string;

  @IsOptional()
  @IsBoolean()
  vatRegistered?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;
}

export class UpdateBusinessStatusDto {
  @IsIn(BUSINESS_STATUSES)
  status!: BusinessStatus;
}

export class UpdateBusinessComplianceDto {
  @IsOptional()
  @IsBoolean()
  cbmsRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  vatRegistered?: boolean;
}

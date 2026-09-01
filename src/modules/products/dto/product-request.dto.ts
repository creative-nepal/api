import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  MEDICAL_UNIT_TYPES,
  type MedicalUnitType,
  UNIT_TYPES,
  type UnitType,
} from '../../../database/schema';

const ALL_UNIT_TYPES = [
  ...new Set<string>([...UNIT_TYPES, ...MEDICAL_UNIT_TYPES]),
];

export class ListProductsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowStockOnly?: boolean;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsIn(ALL_UNIT_TYPES)
  unitType?: UnitType | MedicalUnitType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsObject()
  sectorData?: Record<string, unknown>;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @IsIn(ALL_UNIT_TYPES)
  unitType?: UnitType | MedicalUnitType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  sectorData?: Record<string, unknown>;
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One request stays well inside a request timeout; the client sends batches. */
export const MAX_IMPORT_ROWS = 500;

export class ProductImportRowDto {
  /** Echoed back untouched so the client can map a failure to its row. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;

  @IsOptional() @IsString() @MaxLength(64) sku?: string;

  @IsOptional() @IsString() @MaxLength(32) unitType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  unitsPerPack?: number;

  @IsOptional() @IsString() @MaxLength(16) subUnitLabel?: string;

  @Type(() => Number) @IsInt() @Min(0) priceCents!: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) costPriceCents?: number;

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

  @IsOptional() @IsString() @MaxLength(128) genericName?: string;
  @IsOptional() @IsString() @MaxLength(64) rackLocation?: string;
  @IsOptional() @IsString() @MaxLength(32) schedule?: string;
  @IsOptional() @IsString() @MaxLength(64) barcode?: string;
}

export class ImportProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ProductImportRowDto)
  rows!: ProductImportRowDto[];

  /** Validate and report without writing anything. */
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

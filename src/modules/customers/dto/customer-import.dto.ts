import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_IMPORT_ROWS } from '../../products/dto/product-import.dto';

export class CustomerImportRowDto {
  @Type(() => Number) @IsInt() @Min(1) rowNumber!: number;

  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;

  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) email?: string;
  @IsOptional() @IsString() @MaxLength(32) panNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditLimitCents?: number;
}

export class ImportCustomersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CustomerImportRowDto)
  rows!: CustomerImportRowDto[];

  @IsOptional() @IsBoolean() dryRun?: boolean;
}

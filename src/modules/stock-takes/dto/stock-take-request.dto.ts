import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import { STOCK_TAKE_STATUSES } from '../../../database/schema';
import type { StockTakeStatus } from '../../../database/schema';

export class OpenStockTakeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  reference!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}

export class CountLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  countedQty!: number;
}

export class RecordCountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CountLineDto)
  lines!: CountLineDto[];
}

export class CompleteStockTakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListStockTakesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(STOCK_TAKE_STATUSES)
  status?: StockTakeStatus;
}

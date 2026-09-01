import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  STOCK_ADJUSTMENT_REASONS,
  type StockAdjustmentReason,
} from '../../../database/schema';

export class CreateStockAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  delta!: number;

  @IsIn(STOCK_ADJUSTMENT_REASONS)
  reason!: StockAdjustmentReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListStockAdjustmentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsIn(STOCK_ADJUSTMENT_REASONS)
  reason?: StockAdjustmentReason;
}

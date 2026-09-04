import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import { WASTAGE_REASONS } from '../../../database/schema';
import type { WastageReason } from '../../../database/schema';

export class RecordWastageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  batchId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsIn(WASTAGE_REASONS)
  reason!: WastageReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListWastageQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(WASTAGE_REASONS)
  reason?: WastageReason;

  @IsOptional()
  @IsString()
  productId?: string;
}

export class WastageReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  sinceDays?: number;
}

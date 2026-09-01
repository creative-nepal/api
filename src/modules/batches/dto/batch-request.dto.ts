import { Type } from 'class-transformer';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  batchNo!: string;

  @IsDateString()
  expiryDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceCents?: number;
}

export class UpdateBatchDto {
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPriceCents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ExpiringBatchesQueryDto extends ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  withinDays: number = 90;
}

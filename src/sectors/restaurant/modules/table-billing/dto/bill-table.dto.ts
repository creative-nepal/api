import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const BILL_SPLIT_MODES = ['items', 'equal', 'percentage'] as const;
export type BillSplitMode = (typeof BILL_SPLIT_MODES)[number];

export class BillSplitDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderItemIds!: string[];
}

export class BillTableDto {
  @IsOptional()
  @IsIn(BILL_SPLIT_MODES)
  mode?: BillSplitMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillSplitDto)
  splits?: BillSplitDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(50)
  ways?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(50)
  @IsNumber({ maxDecimalPlaces: 2 }, { each: true })
  @Min(0.01, { each: true })
  @Max(100, { each: true })
  percentages?: number[];
}

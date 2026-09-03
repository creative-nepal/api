import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BillSplitDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderItemIds!: string[];
}

export class BillTableDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BillSplitDto)
  splits?: BillSplitDto[];
}

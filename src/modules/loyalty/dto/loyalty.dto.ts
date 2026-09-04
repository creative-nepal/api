import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class RedeemPointsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

export class AdjustPointsDto {
  @Type(() => Number)
  @IsInt()
  points!: number;

  @IsString()
  @MaxLength(255)
  note!: string;
}

export class SubmitFeedbackDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ListLoyaltyQueryDto extends ListQueryDto {}

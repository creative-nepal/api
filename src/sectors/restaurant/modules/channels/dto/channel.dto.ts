import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../../../common/dto/list-query.dto';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent!: number;
}

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListChannelsQueryDto extends ListQueryDto {}

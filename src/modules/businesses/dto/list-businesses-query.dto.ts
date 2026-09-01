import { IsIn, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  BUSINESS_STATUSES,
  type BusinessStatus,
  SECTORS,
  type Sector,
} from '../../../database/schema';

export class ListBusinessesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(SECTORS)
  sector?: Sector;

  @IsOptional()
  @IsIn(BUSINESS_STATUSES)
  status?: BusinessStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

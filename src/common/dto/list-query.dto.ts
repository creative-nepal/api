import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export type SortDirection = 'asc' | 'desc';

export class ListQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: SortDirection = 'desc';
}

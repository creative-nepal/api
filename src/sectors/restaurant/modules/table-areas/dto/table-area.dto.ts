import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import type { TableArea } from '../../../../../database/schema';

export class CreateTableAreaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

export class UpdateTableAreaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListTableAreasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class TableAreaResponseDto {
  id: string;
  businessId: string;
  branchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  tableCount: number;

  constructor(area: TableArea, tableCount = 0) {
    this.id = area.id;
    this.businessId = area.businessId;
    this.branchId = area.branchId;
    this.name = area.name;
    this.sortOrder = area.sortOrder;
    this.isActive = area.isActive;
    this.tableCount = tableCount;
  }
}

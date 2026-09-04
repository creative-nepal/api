import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import {
  type RestaurantTable,
  TABLE_STATUSES,
  type TableStatus,
} from '../../../../../database/schema';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tableNo!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  seats?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaId?: string;
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  tableNo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(64)
  seats?: number;

  @IsOptional()
  @IsIn(TABLE_STATUSES)
  status?: TableStatus;

  @IsOptional()
  @IsString()
  assignedWaiterId?: string;

  @IsOptional()
  @IsString()
  areaId?: string | null;
}

export class ListTablesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TABLE_STATUSES)
  status?: TableStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  areaId?: string;
}

export class TableResponseDto {
  id: string;
  businessId: string;
  tableNo: string;
  seats: number;
  status: string;
  assignedWaiterId: string | null;
  areaId: string | null;

  constructor(table: RestaurantTable) {
    this.id = table.id;
    this.businessId = table.businessId;
    this.tableNo = table.tableNo;
    this.seats = table.seats;
    this.status = table.status;
    this.assignedWaiterId = table.assignedWaiterId;
    this.areaId = table.areaId;
  }
}

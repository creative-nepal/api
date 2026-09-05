import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  PRODUCTION_STATUSES,
  type ProductionRun,
  type ProductionStatus,
} from '../../../database/schema';

export class CreateProductionRunDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  menuItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  itemName?: string;

  @IsISO8601({ strict: true })
  plannedFor!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  plannedQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateProductionRunDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  producedQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  wastedQty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitCostCents?: number;

  @IsOptional()
  @IsIn(PRODUCTION_STATUSES)
  status?: ProductionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListProductionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PRODUCTION_STATUSES)
  status?: ProductionStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  plannedFor?: string;
}

export class ProductionRunResponseDto {
  id: string;
  businessId: string;
  branchId: string;
  productId: string | null;
  menuItemId: string | null;
  itemName: string;
  plannedFor: string;
  plannedQty: number;
  producedQty: number;
  wastedQty: number;
  shortfallQty: number;
  unitCostCents: number;
  status: string;
  note: string | null;
  completedAt: Date | null;

  constructor(run: ProductionRun) {
    this.id = run.id;
    this.businessId = run.businessId;
    this.branchId = run.branchId;
    this.productId = run.productId;
    this.menuItemId = run.menuItemId;
    this.itemName = run.itemName;
    this.plannedFor = run.plannedFor;
    this.plannedQty = Number(run.plannedQty);
    this.producedQty = Number(run.producedQty);
    this.wastedQty = Number(run.wastedQty);
    this.shortfallQty = Number(
      (Number(run.plannedQty) - Number(run.producedQty)).toFixed(3),
    );
    this.unitCostCents = run.unitCostCents;
    this.status = run.status;
    this.note = run.note;
    this.completedAt = run.completedAt;
  }
}

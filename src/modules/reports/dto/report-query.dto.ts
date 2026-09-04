import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export const REPORT_FORMATS = ['xlsx', 'csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export class PeriodQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}

export class AsOfQueryDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  asOf?: string;

  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat;
}

export class StockMovementQueryDto extends PeriodQueryDto {
  @IsString()
  @IsNotEmpty()
  @Type(() => String)
  productId!: string;
}

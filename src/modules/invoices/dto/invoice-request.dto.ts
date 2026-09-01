import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { INVOICE_STATUSES, type InvoiceStatus } from '../../../database/schema';

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  fiscalYear?: string;

  @IsOptional()
  @IsIn(INVOICE_STATUSES)
  status?: InvoiceStatus;
}

export class IssueCreditNoteDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subtotalCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ExportRegisterQueryDto {
  @IsString()
  fiscalYear!: string;

  @IsOptional()
  @IsIn(['xlsx', 'csv'])
  format?: 'xlsx' | 'csv';
}

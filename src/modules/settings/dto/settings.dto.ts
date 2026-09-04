import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RECEIPT_WIDTHS } from '../../../database/schema';
import type { ReceiptWidth } from '../../../database/schema';

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(32) contactPhone?: string;
  @IsOptional() @IsEmail() @MaxLength(255) contactEmail?: string;
  @IsOptional() @IsString() @MaxLength(255) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(255) website?: string;
  @IsOptional() @IsString() @MaxLength(500) invoiceFooter?: string;

  @IsOptional() @IsIn(RECEIPT_WIDTHS) receiptWidth?: ReceiptWidth;
  @IsOptional() @IsBoolean() showLogoOnReceipt?: boolean;

  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsIn(['en', 'ne']) defaultLocale?: 'en' | 'ne';

  @IsOptional() @IsBoolean() digestEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;

  @IsOptional() @IsBoolean() lowStockAlertsEnabled?: boolean;
  @IsOptional() @IsBoolean() expiryAlertsEnabled?: boolean;
}

export class SetBranchRoleDto {
  @IsString() @MaxLength(64) role!: string;
}

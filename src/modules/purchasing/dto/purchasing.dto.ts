import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  Max,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  DEBIT_NOTE_REASONS,
  type DebitNoteReason,
} from '../../../database/schema';

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(32) panNumber?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(128) contact?: string;
}

export class PurchaseOrderItemDto {
  @IsString() @IsNotEmpty() productId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  orderedQty!: number;

  @Type(() => Number) @IsInt() @Min(0) purchasePriceCents!: number;

  @IsOptional() @IsString() @MaxLength(64) batchNo?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
}

export class CreatePurchaseOrderDto {
  @IsString() @IsNotEmpty() supplierId!: string;

  @IsOptional() @IsString() @MaxLength(64) reference?: string;
  @IsOptional() @IsDateString() expectedAt?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class ReceiveLineDto {
  @IsString() @IsNotEmpty() purchaseOrderItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  receivedQty!: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
}

export class PurchaseBillItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @IsNotEmpty() @MaxLength(255) description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity?: number;

  @Type(() => Number) @IsInt() @Min(0) unitPriceCents!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vatCents?: number;
}

export class CreatePurchaseBillDto {
  @IsString() @IsNotEmpty() supplierId!: string;
  @IsOptional() @IsString() purchaseOrderId?: string;

  @IsString() @IsNotEmpty() @MaxLength(64) billNumber!: string;
  @IsDateString() billDate!: string;
  @IsOptional() @IsDateString() dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  tdsRateBasisPoints?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseBillItemDto)
  items!: PurchaseBillItemDto[];
}

export class DebitNoteItemDto {
  @IsOptional() @IsString() purchaseBillItemId?: string;
  @IsOptional() @IsString() productId?: string;
  @IsString() @IsNotEmpty() @MaxLength(255) description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity?: number;

  @Type(() => Number) @IsInt() @Min(0) unitPriceCents!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) vatCents?: number;
}

export class CreateDebitNoteDto {
  @IsIn(DEBIT_NOTE_REASONS) reason!: DebitNoteReason;
  @IsOptional() @IsString() @MaxLength(500) note?: string;

  @IsOptional() @IsBoolean() restock?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DebitNoteItemDto)
  items!: DebitNoteItemDto[];
}

export class RecordPaymentDto {
  @Type(() => Number) @IsInt() @Min(1) amountCents!: number;
}

export class ListPurchaseQueryDto extends ListQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() search?: string;
}

export class ListDebitNotesQueryDto extends ListQueryDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() purchaseBillId?: string;
}

export type ListDebitNotesFilters = ListDebitNotesQueryDto;

export type ListPurchaseFilters = ListPurchaseQueryDto;

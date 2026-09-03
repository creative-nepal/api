import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  BUSINESS_PAYMENT_METHODS,
  CASH_MOVEMENT_DIRECTIONS,
  CASH_SESSION_STATUSES,
} from '../../../database/schema';
import type {
  BusinessPaymentMethod,
  CashMovementDirection,
  CashSessionStatus,
} from '../../../database/schema';

export class PaymentDto {
  @IsIn(BUSINESS_PAYMENT_METHODS)
  method!: BusinessPaymentMethod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}

export class RecordPaymentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments!: PaymentDto[];
}

export class OpenCashSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  openingFloatCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CloseCashSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedCashCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CashMovementDto {
  @IsIn(CASH_MOVEMENT_DIRECTIONS)
  direction!: CashMovementDirection;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;
}

export class ListCashSessionsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CASH_SESSION_STATUSES)
  status?: CashSessionStatus;
}

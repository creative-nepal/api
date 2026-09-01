import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  BUYER_ID_TYPES,
  type BuyerIdType,
  ORDER_SOURCES,
  type OrderSource,
  ORDER_STATUSES,
  type OrderStatus,
} from '../../../database/schema';

export class CheckoutItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  menuItemId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsArray()
  modifiers?: Array<{ name: string; label: string }>;
}

export class PrescriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  doctorName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  patientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  attachmentUrl!: string;
}

export class BuyerIdentityDto {
  @IsIn(BUYER_ID_TYPES)
  idType!: BuyerIdType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  idNumber!: string;
}

export class InsuranceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  policyNumber!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  claimedAmountCents?: number;
}

export class CheckoutBuyerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  panNumber?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutBuyerDto)
  customer?: CheckoutBuyerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsOptional()
  @IsObject()
  sectorData?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  clientRequestId?: string;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsIn(ORDER_SOURCES)
  source?: OrderSource;

  @IsOptional()
  @ValidateNested()
  @Type(() => PrescriptionDto)
  prescription?: PrescriptionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BuyerIdentityDto)
  buyerIdentity?: BuyerIdentityDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InsuranceDto)
  insurance?: InsuranceDto;
}

export class ListOrdersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}

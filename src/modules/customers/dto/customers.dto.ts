import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsString() @MaxLength(32) panNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditLimitCents?: number;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) creditLimitCents?: number;
}

export class RecordPaymentDto {
  @Type(() => Number) @IsInt() @Min(1) amountCents!: number;
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}

export class ListCustomersQueryDto extends ListQueryDto {
  @IsOptional() @IsString() search?: string;
  /** Only customers who currently owe money. */
  @IsOptional() @IsString() owing?: string;
}

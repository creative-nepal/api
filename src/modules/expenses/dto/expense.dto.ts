import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  BUSINESS_PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
} from '../../../database/schema';
import type {
  BusinessPaymentMethod,
  ExpenseCategory,
} from '../../../database/schema';

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES)
  category!: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsIn(BUSINESS_PAYMENT_METHODS)
  paidVia!: BusinessPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;
}

export class ListExpensesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(EXPENSE_CATEGORIES)
  category?: ExpenseCategory;
}

export class ExpenseReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sinceDays?: number;
}

import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  INSURANCE_CLAIM_STATUSES,
  type InsuranceClaimStatus,
} from '../../../../../database/schema';

export class TransitionClaimDto {
  @IsIn(INSURANCE_CLAIM_STATUSES) status!: InsuranceClaimStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  settledAmountCents?: number;

  @IsOptional() @IsString() @MaxLength(64) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

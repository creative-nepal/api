import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  BILLING_CYCLES,
  type BillingCycle,
  type PlanFeatureFlags,
  SECTORS,
  type Sector,
} from '../../../database/schema';

export class ListPlansQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(SECTORS)
  sector?: Sector;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePlanDto {
  @IsIn(SECTORS)
  sector!: Sector;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'key must be a lowercase slug, e.g. mart-pro',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsObject()
  featureFlags?: PlanFeatureFlags;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsObject()
  featureFlags?: PlanFeatureFlags;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

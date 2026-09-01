import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @IsBoolean()
  trial?: boolean;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  immediate?: boolean;
}

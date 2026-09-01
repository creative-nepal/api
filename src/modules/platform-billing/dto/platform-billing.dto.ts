import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  PAYMENT_PROVIDERS,
  type PaymentProvider,
} from '../../../database/schema';

export class AddPaymentMethodDto {
  @IsIn(PAYMENT_PROVIDERS)
  provider!: PaymentProvider;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  gatewayToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  displayLabel!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

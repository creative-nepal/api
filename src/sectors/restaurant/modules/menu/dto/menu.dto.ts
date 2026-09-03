import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../common/dto/pagination-query.dto';
import type { MenuItem, MenuModifier } from '../../../../../database/schema';

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  category!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents!: number;

  @IsOptional()
  @IsArray()
  modifiers?: MenuModifier[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  station?: string;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsArray()
  modifiers?: MenuModifier[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  station?: string;
}

export class SetAvailabilityDto {
  @IsBoolean()
  isAvailable!: boolean;
}

export class ListMenuQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  override limit: number = 200;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableOnly?: boolean;
}

export class MenuItemResponseDto {
  id: string;
  businessId: string;
  name: string;
  category: string;
  priceCents: number;
  modifiers: MenuModifier[];
  isAvailable: boolean;
  imageUrl: string | null;
  station: string;

  constructor(item: MenuItem) {
    this.id = item.id;
    this.businessId = item.businessId;
    this.name = item.name;
    this.category = item.category;
    this.priceCents = item.priceCents;
    this.modifiers = item.modifiers;
    this.isAvailable = item.isAvailable;
    this.imageUrl = item.imageUrl;
    this.station = item.station;
  }
}

export class RecipeLineDto {
  @IsString() @IsNotEmpty() productId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;
}

export class SetRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeLineDto)
  lines!: RecipeLineDto[];
}

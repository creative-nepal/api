import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';
import {
  CONTENT_LOCALES,
  CONTENT_PAGE_STATUSES,
  type ContentLocale,
  type ContentPageStatus,
} from '../../../database/schema';

export class ListContentPagesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(CONTENT_PAGE_STATUSES)
  status?: ContentPageStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class PublicContentQueryDto {
  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: ContentLocale;
}

export class CreateContentPageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  navLabel?: string;

  @IsOptional()
  @IsIn(CONTENT_LOCALES)
  locale?: ContentLocale;
}

export class UpdateContentPageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  slug?: string;
}

export class UpsertPageTranslationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  navLabel?: string;

  @IsOptional()
  @IsObject()
  seo?: unknown;

  @IsOptional()
  @IsArray()
  blocks?: unknown;
}

export class UpdateNavigationDto {
  @IsOptional()
  @IsArray()
  header?: unknown;

  @IsOptional()
  @IsArray()
  footer?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  copyright?: string;
}

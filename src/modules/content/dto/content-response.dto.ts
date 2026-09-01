import { Exclude, Expose } from 'class-transformer';
import type {
  ContentBlock,
  ContentLocale,
  ContentPageStatus,
  ContentPageTranslation,
  ContentSeo,
} from '../../../database/schema';
import type { ContentPageWithTranslations } from '../content.repository';

@Exclude()
export class ContentPageTranslationDto {
  @Expose() locale: ContentLocale;
  @Expose() title: string;
  @Expose() navLabel: string | null;
  @Expose() seo: ContentSeo;
  @Expose() blocks: ContentBlock[];
  @Expose() updatedAt: Date;

  constructor(translation: ContentPageTranslation) {
    this.locale = translation.locale;
    this.title = translation.title;
    this.navLabel = translation.navLabel;
    this.seo = translation.seo;
    this.blocks = translation.blocks;
    this.updatedAt = translation.updatedAt;
  }
}

@Exclude()
export class ContentPageDto {
  @Expose() id: string;
  @Expose() slug: string;
  @Expose() status: ContentPageStatus;
  @Expose() publishedAt: Date | null;
  @Expose() createdAt: Date;
  @Expose() updatedAt: Date;
  @Expose() translations: ContentPageTranslationDto[];

  constructor(page: ContentPageWithTranslations) {
    this.id = page.id;
    this.slug = page.slug;
    this.status = page.status;
    this.publishedAt = page.publishedAt;
    this.createdAt = page.createdAt;
    this.updatedAt = page.updatedAt;
    this.translations = page.translations.map(
      (translation) => new ContentPageTranslationDto(translation),
    );
  }
}

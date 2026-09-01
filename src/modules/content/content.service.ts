import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ZodType } from 'zod';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  type ContentBlock,
  type ContentFooterGroup,
  type ContentLocale,
  type ContentNavLink,
  type ContentNavigation,
  type ContentPage,
  type ContentPageStatus,
  type ContentPageTranslation,
  type ContentSeo,
  DEFAULT_CONTENT_LOCALE,
} from '../../database/schema';
import { ContentRevalidationService } from './content-revalidation.service';
import {
  type ContentPageWithTranslations,
  ContentRepository,
  type ListContentPagesFilters,
} from './content.repository';
import {
  contentBlocksSchema,
  contentFooterGroupsSchema,
  contentNavLinksSchema,
  contentSeoSchema,
  contentSlugSchema,
} from './content.schema';
import type {
  CreateContentPageDto,
  UpdateContentPageDto,
  UpdateNavigationDto,
  UpsertPageTranslationDto,
} from './dto/content-request.dto';

export const HOME_SLUG = 'home';

export interface PublicContentPage {
  slug: string;
  locale: ContentLocale;
  requestedLocale: ContentLocale;
  title: string;
  seo: ContentSeo;
  blocks: ContentBlock[];
  status: ContentPageStatus;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface PublicNavigation {
  locale: ContentLocale;
  header: ContentNavLink[];
  footer: ContentFooterGroup[];
  tagline: string | null;
  copyright: string | null;
}

@Injectable()
export class ContentService {
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly revalidation: ContentRevalidationService,
  ) {}

  async getPublicPage(
    slug: string,
    locale: ContentLocale,
    includeDrafts = false,
  ): Promise<PublicContentPage> {
    const page = await this.contentRepository.findPageBySlug(slug);

    if (!page || (!includeDrafts && page.status !== 'published')) {
      throw new NotFoundException({
        message: 'i18n:errors.content.pageNotFound',
        slug,
      });
    }

    const translations = await this.contentRepository.findTranslations(page.id);
    const translation =
      translations.find((row) => row.locale === locale) ??
      translations.find((row) => row.locale === DEFAULT_CONTENT_LOCALE);

    if (!translation) {
      throw new NotFoundException({
        message: 'i18n:errors.content.translationMissing',
        slug,
        locale,
      });
    }

    return {
      slug: page.slug,
      locale: translation.locale,
      requestedLocale: locale,
      title: translation.title,
      seo: translation.seo,
      blocks: translation.blocks,
      status: page.status,
      publishedAt: page.publishedAt,
      updatedAt: translation.updatedAt,
    };
  }

  async listPublicPages(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.contentRepository.findPublishedSlugs();
  }

  async getPublicNavigation(locale: ContentLocale): Promise<PublicNavigation> {
    const navigation =
      (await this.contentRepository.findNavigation(locale)) ??
      (await this.contentRepository.findNavigation(DEFAULT_CONTENT_LOCALE));

    return {
      locale: navigation?.locale ?? locale,
      header: navigation?.header ?? [],
      footer: navigation?.footer ?? [],
      tagline: navigation?.tagline ?? null,
      copyright: navigation?.copyright ?? null,
    };
  }

  async list(
    filters: ListContentPagesFilters,
  ): Promise<PaginatedResult<ContentPageWithTranslations>> {
    const [data, total] = await Promise.all([
      this.contentRepository.findMany(filters),
      this.contentRepository.countMany(filters),
    ]);

    return { data, total, limit: filters.limit, offset: filters.offset };
  }

  async getById(id: string): Promise<ContentPageWithTranslations> {
    const page = await this.contentRepository.findPageById(id);

    if (!page) {
      throw new NotFoundException({
        message: 'i18n:errors.content.pageNotFound',
        slug: id,
      });
    }

    return {
      ...page,
      translations: await this.contentRepository.findTranslations(id),
    };
  }

  async create(
    dto: CreateContentPageDto,
    userId: string,
  ): Promise<ContentPageWithTranslations> {
    const slug = this.parse(contentSlugSchema, dto.slug, 'slug');
    const existing = await this.contentRepository.findPageBySlug(slug);

    if (existing) {
      throw new ConflictException({
        message: 'i18n:errors.content.slugTaken',
        slug,
      });
    }

    const page = await this.contentRepository.insertPage({
      id: randomUUID(),
      slug,
      status: 'draft',
      updatedByUserId: userId,
    });

    await this.contentRepository.upsertTranslation({
      id: randomUUID(),
      pageId: page.id,
      locale: dto.locale ?? DEFAULT_CONTENT_LOCALE,
      title: dto.title,
      navLabel: dto.navLabel ?? null,
      seo: {},
      blocks: [],
    });

    return this.getById(page.id);
  }

  async update(
    id: string,
    dto: UpdateContentPageDto,
    userId: string,
  ): Promise<ContentPageWithTranslations> {
    const page = await this.requirePage(id);

    const patch: Partial<Omit<ContentPage, 'id' | 'createdAt'>> = {
      updatedByUserId: userId,
    };

    if (dto.slug !== undefined) {
      const slug = this.parse(contentSlugSchema, dto.slug, 'slug');

      if (slug !== page.slug) {
        if (page.slug === HOME_SLUG) {
          throw new ConflictException({
            message: 'i18n:errors.content.homeSlugImmutable',
          });
        }

        const clash = await this.contentRepository.findPageBySlug(slug);

        if (clash) {
          throw new ConflictException({
            message: 'i18n:errors.content.slugTaken',
            slug,
          });
        }

        patch.slug = slug;
      }
    }

    await this.contentRepository.updatePage(id, patch);
    await this.revalidation.revalidate();

    return this.getById(id);
  }

  async saveTranslation(
    id: string,
    locale: ContentLocale,
    dto: UpsertPageTranslationDto,
    userId: string,
  ): Promise<ContentPageTranslation> {
    await this.requirePage(id);

    const blocks = this.parse(contentBlocksSchema, dto.blocks ?? [], 'blocks');
    const seo = this.parse(contentSeoSchema, dto.seo ?? {}, 'seo');
    const existing = await this.contentRepository.findTranslation(id, locale);

    const translation = await this.contentRepository.upsertTranslation({
      id: existing?.id ?? randomUUID(),
      pageId: id,
      locale,
      title: dto.title,
      navLabel: dto.navLabel ?? null,
      seo,
      blocks,
    });

    await this.contentRepository.updatePage(id, { updatedByUserId: userId });
    await this.revalidation.revalidate();

    return translation;
  }

  async publish(
    id: string,
    userId: string,
  ): Promise<ContentPageWithTranslations> {
    const page = await this.requirePage(id);
    const translations = await this.contentRepository.findTranslations(id);
    const canonical = translations.find(
      (row) => row.locale === DEFAULT_CONTENT_LOCALE,
    );

    if (!canonical || canonical.blocks.length === 0) {
      throw new BadRequestException({
        message: 'i18n:errors.content.nothingToPublish',
        slug: page.slug,
        locale: DEFAULT_CONTENT_LOCALE,
      });
    }

    await this.contentRepository.updatePage(id, {
      status: 'published',
      publishedAt: page.publishedAt ?? new Date(),
      updatedByUserId: userId,
    });
    await this.revalidation.revalidate();

    return this.getById(id);
  }

  async unpublish(
    id: string,
    userId: string,
  ): Promise<ContentPageWithTranslations> {
    const page = await this.requirePage(id);

    if (page.slug === HOME_SLUG) {
      throw new ConflictException({
        message: 'i18n:errors.content.homeAlwaysPublished',
      });
    }

    await this.contentRepository.updatePage(id, {
      status: 'draft',
      updatedByUserId: userId,
    });
    await this.revalidation.revalidate();

    return this.getById(id);
  }

  async remove(id: string): Promise<void> {
    const page = await this.requirePage(id);

    if (page.slug === HOME_SLUG) {
      throw new ConflictException({
        message: 'i18n:errors.content.homeAlwaysPublished',
      });
    }

    await this.contentRepository.deletePage(id);
    await this.revalidation.revalidate();
  }

  async getNavigation(locale: ContentLocale): Promise<PublicNavigation> {
    const navigation = await this.contentRepository.findNavigation(locale);

    return {
      locale,
      header: navigation?.header ?? [],
      footer: navigation?.footer ?? [],
      tagline: navigation?.tagline ?? null,
      copyright: navigation?.copyright ?? null,
    };
  }

  async saveNavigation(
    locale: ContentLocale,
    dto: UpdateNavigationDto,
    userId: string,
  ): Promise<ContentNavigation> {
    const header = this.parse(
      contentNavLinksSchema,
      dto.header ?? [],
      'header',
    );
    const footer = this.parse(
      contentFooterGroupsSchema,
      dto.footer ?? [],
      'footer',
    );

    const navigation = await this.contentRepository.upsertNavigation({
      locale,
      header,
      footer,
      tagline: dto.tagline ?? null,
      copyright: dto.copyright ?? null,
      updatedByUserId: userId,
    });

    await this.revalidation.revalidate();

    return navigation;
  }

  private async requirePage(id: string): Promise<ContentPage> {
    const page = await this.contentRepository.findPageById(id);

    if (!page) {
      throw new NotFoundException({
        message: 'i18n:errors.content.pageNotFound',
        slug: id,
      });
    }

    return page;
  }

  private parse<T>(schema: ZodType<T>, value: unknown, field: string): T {
    const result = schema.safeParse(value);

    if (!result.success) {
      const [issue] = result.error.issues;
      const path = issue?.path.join('.');

      throw new BadRequestException({
        message: 'i18n:errors.content.invalidPayload',
        field: path ? `${field}.${path}` : field,
        detail: issue?.message ?? 'invalid',
      });
    }

    return result.data;
  }
}

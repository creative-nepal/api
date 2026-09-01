import { Injectable } from '@nestjs/common';
import { and, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { SortDirection } from '../../common/dto/list-query.dto';
import { resolveOrderBy } from '../../common/repository/sorting';
import { type Database, InjectDatabase, schema } from '../../database';
import type {
  ContentLocale,
  ContentNavigation,
  ContentPage,
  ContentPageStatus,
  ContentPageTranslation,
  NewContentNavigation,
  NewContentPage,
  NewContentPageTranslation,
} from '../../database/schema';

export interface ListContentPagesFilters {
  limit: number;
  offset: number;
  status?: ContentPageStatus;
  search?: string;
  sortBy?: string;
  sortDirection: SortDirection;
}

export interface ContentPageWithTranslations extends ContentPage {
  translations: ContentPageTranslation[];
}

const SORTABLE = {
  slug: schema.contentPages.slug,
  status: schema.contentPages.status,
  publishedAt: schema.contentPages.publishedAt,
  createdAt: schema.contentPages.createdAt,
  updatedAt: schema.contentPages.updatedAt,
};

@Injectable()
export class ContentRepository {
  constructor(@InjectDatabase() private readonly db: Database) {}

  async findPageById(id: string): Promise<ContentPage | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.contentPages)
      .where(eq(schema.contentPages.id, id))
      .limit(1);
    return row;
  }

  async findPageBySlug(slug: string): Promise<ContentPage | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.contentPages)
      .where(eq(schema.contentPages.slug, slug))
      .limit(1);
    return row;
  }

  async findPublishedSlugs(): Promise<
    Array<Pick<ContentPage, 'slug' | 'updatedAt'>>
  > {
    return this.db
      .select({
        slug: schema.contentPages.slug,
        updatedAt: schema.contentPages.updatedAt,
      })
      .from(schema.contentPages)
      .where(eq(schema.contentPages.status, 'published'))
      .orderBy(schema.contentPages.slug);
  }

  async findMany(
    filters: ListContentPagesFilters,
  ): Promise<ContentPageWithTranslations[]> {
    const pages = await this.db
      .select()
      .from(schema.contentPages)
      .where(this.buildWhere(filters))
      .orderBy(
        resolveOrderBy(
          SORTABLE,
          filters.sortBy,
          filters.sortDirection,
          schema.contentPages.updatedAt,
        ),
      )
      .limit(filters.limit)
      .offset(filters.offset);

    return this.attachTranslations(pages);
  }

  async countMany(filters: ListContentPagesFilters): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(schema.contentPages)
      .where(this.buildWhere(filters));
    return row?.value ?? 0;
  }

  async findTranslations(pageId: string): Promise<ContentPageTranslation[]> {
    return this.db
      .select()
      .from(schema.contentPageTranslations)
      .where(eq(schema.contentPageTranslations.pageId, pageId))
      .orderBy(schema.contentPageTranslations.locale);
  }

  async findTranslation(
    pageId: string,
    locale: ContentLocale,
  ): Promise<ContentPageTranslation | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.contentPageTranslations)
      .where(
        and(
          eq(schema.contentPageTranslations.pageId, pageId),
          eq(schema.contentPageTranslations.locale, locale),
        ),
      )
      .limit(1);
    return row;
  }

  async insertPage(values: NewContentPage): Promise<ContentPage> {
    const [row] = await this.db
      .insert(schema.contentPages)
      .values(values)
      .returning();
    return row;
  }

  async updatePage(
    id: string,
    patch: Partial<Omit<ContentPage, 'id' | 'createdAt'>>,
  ): Promise<ContentPage | undefined> {
    const [row] = await this.db
      .update(schema.contentPages)
      .set(patch)
      .where(eq(schema.contentPages.id, id))
      .returning();
    return row;
  }

  async deletePage(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(schema.contentPages)
      .where(eq(schema.contentPages.id, id))
      .returning({ id: schema.contentPages.id });
    return rows.length > 0;
  }

  async upsertTranslation(
    values: NewContentPageTranslation,
  ): Promise<ContentPageTranslation> {
    const [row] = await this.db
      .insert(schema.contentPageTranslations)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.contentPageTranslations.pageId,
          schema.contentPageTranslations.locale,
        ],
        set: {
          title: values.title,
          navLabel: values.navLabel ?? null,
          seo: values.seo,
          blocks: values.blocks,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async findNavigation(
    locale: ContentLocale,
  ): Promise<ContentNavigation | undefined> {
    const [row] = await this.db
      .select()
      .from(schema.contentNavigation)
      .where(eq(schema.contentNavigation.locale, locale))
      .limit(1);
    return row;
  }

  async upsertNavigation(
    values: NewContentNavigation,
  ): Promise<ContentNavigation> {
    const [row] = await this.db
      .insert(schema.contentNavigation)
      .values(values)
      .onConflictDoUpdate({
        target: schema.contentNavigation.locale,
        set: {
          header: values.header,
          footer: values.footer,
          tagline: values.tagline ?? null,
          copyright: values.copyright ?? null,
          updatedByUserId: values.updatedByUserId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  private async attachTranslations(
    pages: ContentPage[],
  ): Promise<ContentPageWithTranslations[]> {
    if (pages.length === 0) {
      return [];
    }

    const translations = await this.db
      .select()
      .from(schema.contentPageTranslations)
      .where(
        inArray(
          schema.contentPageTranslations.pageId,
          pages.map((page) => page.id),
        ),
      );

    const byPage = new Map<string, ContentPageTranslation[]>();

    for (const translation of translations) {
      const bucket = byPage.get(translation.pageId) ?? [];
      bucket.push(translation);
      byPage.set(translation.pageId, bucket);
    }

    return pages.map((page) => ({
      ...page,
      translations: byPage.get(page.id) ?? [],
    }));
  }

  private buildWhere(filters: ListContentPagesFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.status) {
      conditions.push(eq(schema.contentPages.status, filters.status));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      const match = or(
        ilike(schema.contentPages.slug, term),
        eq(schema.contentPages.id, filters.search),
      );

      if (match) {
        conditions.push(match);
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

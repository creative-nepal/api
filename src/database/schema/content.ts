import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const CONTENT_LOCALES = ['en', 'ne'] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];
export const DEFAULT_CONTENT_LOCALE: ContentLocale = 'en';

export const CONTENT_PAGE_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;
export type ContentPageStatus = (typeof CONTENT_PAGE_STATUSES)[number];

export const CONTENT_BLOCK_TYPES = [
  'hero',
  'features',
  'richText',
  'faq',
  'cta',
  'pricing',
] as const;
export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number];

export interface HeroBlock {
  id: string;
  type: 'hero';
  heading: string;
  subheading?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  imageUrl?: string;
}

export interface FeaturesBlock {
  id: string;
  type: 'features';
  heading?: string;
  subheading?: string;
  items: Array<{ title: string; body: string; icon?: string }>;
}

export interface RichTextBlock {
  id: string;
  type: 'richText';
  heading?: string;
  markdown: string;
}

export interface FaqBlock {
  id: string;
  type: 'faq';
  heading?: string;
  items: Array<{ question: string; answer: string }>;
}

export interface CtaBlock {
  id: string;
  type: 'cta';
  heading: string;
  body?: string;
  buttonLabel: string;
  buttonHref: string;
}

export interface PricingBlock {
  id: string;
  type: 'pricing';
  heading?: string;
  subheading?: string;
  sector?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export type ContentBlock =
  | HeroBlock
  | FeaturesBlock
  | RichTextBlock
  | FaqBlock
  | CtaBlock
  | PricingBlock;

export interface ContentSeo {
  title?: string;
  description?: string;
  ogImageUrl?: string;
  noIndex?: boolean;
}

export interface ContentNavLink {
  id: string;
  label: string;
  href: string;
  external?: boolean;
}

export interface ContentFooterGroup {
  id: string;
  label: string;
  links: ContentNavLink[];
}

export const contentPages = pgTable(
  'content_pages',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    status: text('status')
      .$type<ContentPageStatus>()
      .default('draft')
      .notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedByUserId: text('updated_by_user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('content_pages_slug_uidx').on(table.slug),
    index('content_pages_status_idx').on(table.status),
  ],
);

export const contentPageTranslations = pgTable(
  'content_page_translations',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => contentPages.id, { onDelete: 'cascade' }),
    locale: text('locale').$type<ContentLocale>().notNull(),
    title: text('title').notNull(),
    navLabel: text('nav_label'),
    seo: jsonb('seo').$type<ContentSeo>().default({}).notNull(),
    blocks: jsonb('blocks').$type<ContentBlock[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('content_page_translations_page_locale_uidx').on(
      table.pageId,
      table.locale,
    ),
  ],
);

export const contentNavigation = pgTable('content_navigation', {
  locale: text('locale').$type<ContentLocale>().primaryKey(),
  header: jsonb('header').$type<ContentNavLink[]>().default([]).notNull(),
  footer: jsonb('footer').$type<ContentFooterGroup[]>().default([]).notNull(),
  tagline: text('tagline'),
  copyright: text('copyright'),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type ContentPage = typeof contentPages.$inferSelect;
export type NewContentPage = typeof contentPages.$inferInsert;
export type ContentPageTranslation =
  typeof contentPageTranslations.$inferSelect;
export type NewContentPageTranslation =
  typeof contentPageTranslations.$inferInsert;
export type ContentNavigation = typeof contentNavigation.$inferSelect;
export type NewContentNavigation = typeof contentNavigation.$inferInsert;

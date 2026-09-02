import { z } from 'zod';
import {
  CONTENT_LOCALES,
  CONTENT_PAGE_STATUSES,
  type ContentBlock,
  type ContentFooterGroup,
  type ContentNavLink,
  type ContentSeo,
} from '../../database/schema';

const SAFE_HREF =
  /^(?:\/[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[^\s]+|#[^\s]*)$/i;

const href = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .regex(
    SAFE_HREF,
    'href must be a site path (/pricing) or an http(s), mailto or tel URL',
  );

const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .regex(
    /^(?:\/[^\s]*|https?:\/\/[^\s]+)$/i,
    'imageUrl must be a site path or an http(s) URL',
  );

const blockId = z.string().trim().min(1).max(64);
const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(2000);

export const contentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'slug must be a single lowercase segment, e.g. pricing or about-us',
  );

export const contentLocaleSchema = z.enum(CONTENT_LOCALES);
export const contentPageStatusSchema = z.enum(CONTENT_PAGE_STATUSES);

const heroBlockSchema = z.object({
  id: blockId,
  type: z.literal('hero'),
  heading: shortText,
  subheading: longText.optional(),
  ctaLabel: shortText.optional(),
  ctaHref: href.optional(),
  secondaryCtaLabel: shortText.optional(),
  secondaryCtaHref: href.optional(),
  imageUrl: imageUrl.optional(),
});

const featuresBlockSchema = z.object({
  id: blockId,
  type: z.literal('features'),
  heading: shortText.optional(),
  subheading: longText.optional(),
  items: z
    .array(
      z.object({
        title: shortText,
        body: longText,
        icon: z.string().trim().max(64).optional(),
      }),
    )
    .min(1)
    .max(12),
});

const richTextBlockSchema = z.object({
  id: blockId,
  type: z.literal('richText'),
  heading: shortText.optional(),
  markdown: z.string().trim().min(1).max(20_000),
});

const faqBlockSchema = z.object({
  id: blockId,
  type: z.literal('faq'),
  heading: shortText.optional(),
  items: z
    .array(z.object({ question: shortText, answer: longText }))
    .min(1)
    .max(30),
});

const ctaBlockSchema = z.object({
  id: blockId,
  type: z.literal('cta'),
  heading: shortText,
  body: longText.optional(),
  buttonLabel: shortText,
  buttonHref: href,
});

const pricingBlockSchema = z.object({
  id: blockId,
  type: z.literal('pricing'),
  heading: shortText.optional(),
  subheading: longText.optional(),
  sector: z
    .string()
    .trim()
    .max(32)
    .regex(/^[a-z][a-z0-9-]*$/)
    .optional(),
  ctaLabel: shortText.optional(),
  ctaHref: href.optional(),
});

export const contentBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  featuresBlockSchema,
  richTextBlockSchema,
  faqBlockSchema,
  ctaBlockSchema,
  pricingBlockSchema,
]);

export const contentBlocksSchema = z.array(contentBlockSchema).max(50);

export const contentSeoSchema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(320).optional(),
  ogImageUrl: imageUrl.optional(),
  noIndex: z.boolean().optional(),
});

export const contentNavLinkSchema = z.object({
  id: blockId,
  label: shortText,
  href,
  external: z.boolean().optional(),
});

export const contentNavLinksSchema = z.array(contentNavLinkSchema).max(20);

export const contentFooterGroupsSchema = z
  .array(
    z.object({
      id: blockId,
      label: shortText,
      links: z.array(contentNavLinkSchema).max(20),
    }),
  )
  .max(6);

export type ParsedContentBlocks = ContentBlock[];
export type ParsedContentSeo = ContentSeo;
export type ParsedNavLinks = ContentNavLink[];
export type ParsedFooterGroups = ContentFooterGroup[];

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import {
  type ContentBlock,
  type ContentFooterGroup,
  type ContentLocale,
  type ContentNavLink,
  type ContentSeo,
  contentNavigation,
  contentPages,
  contentPageTranslations,
} from './schema/content';

interface SeedTranslation {
  locale: ContentLocale;
  title: string;
  navLabel: string;
  seo: ContentSeo;
  blocks: ContentBlock[];
}

interface SeedPage {
  slug: string;
  status: 'draft' | 'published';
  translations: SeedTranslation[];
}

const SEED_PAGES: SeedPage[] = [
  {
    slug: 'home',
    status: 'published',
    translations: [
      {
        locale: 'en',
        title: 'Creative Nepal',
        navLabel: 'Home',
        seo: {
          title: 'Creative Nepal — billing built for Nepali business',
          description:
            'Point of sale, IRD-ready invoicing and stock control for marts, pharmacies and restaurants.',
        },
        blocks: [
          {
            id: 'home-hero',
            type: 'hero',
            heading: 'Billing built for Nepali business',
            subheading:
              'Point of sale, IRD-ready invoicing and stock control for marts, pharmacies and restaurants — in one place.',
            ctaLabel: 'Start free',
            ctaHref: '/register',
            secondaryCtaLabel: 'See pricing',
            secondaryCtaHref: '/pricing',
          },
          {
            id: 'home-features',
            type: 'features',
            heading: 'One system, every counter',
            items: [
              {
                title: 'Point of sale',
                body: 'Ring up sales in seconds, split payments, and print or share the bill straight from the counter.',
              },
              {
                title: 'IRD-ready invoicing',
                body: 'Sequential invoice numbers, VAT breakdowns and CBMS sync, so filing is a report rather than a rebuild.',
              },
              {
                title: 'Stock that stays honest',
                body: 'Batch and expiry tracking for pharmacies, recipe-level depletion for kitchens, purchase orders for everyone.',
              },
            ],
          },
          {
            id: 'home-cta',
            type: 'cta',
            heading: 'Ready when your counter is',
            body: 'Create a business, add your staff, and issue your first invoice today.',
            buttonLabel: 'Create your business',
            buttonHref: '/register',
          },
        ],
      },
      {
        locale: 'ne',
        title: 'क्रिएटिभ नेपाल',
        navLabel: 'गृह',
        seo: {
          title: 'क्रिएटिभ नेपाल — नेपाली व्यवसायका लागि बिलिङ',
          description:
            'मार्ट, फार्मेसी र रेस्टुरेन्टका लागि पीओएस, आईआरडी-तयार बिलिङ र स्टक व्यवस्थापन।',
        },
        blocks: [
          {
            id: 'home-hero',
            type: 'hero',
            heading: 'नेपाली व्यवसायका लागि बनेको बिलिङ',
            subheading:
              'मार्ट, फार्मेसी र रेस्टुरेन्टका लागि पीओएस, आईआरडी-तयार बिलिङ र स्टक नियन्त्रण — एकै ठाउँमा।',
            ctaLabel: 'नि:शुल्क सुरु गर्नुहोस्',
            ctaHref: '/register',
            secondaryCtaLabel: 'मूल्य हेर्नुहोस्',
            secondaryCtaHref: '/pricing',
          },
        ],
      },
    ],
  },
  {
    slug: 'pricing',
    status: 'published',
    translations: [
      {
        locale: 'en',
        title: 'Pricing',
        navLabel: 'Pricing',
        seo: {
          title: 'Pricing — Creative Nepal',
          description:
            'Simple monthly plans per business, priced for marts, pharmacies and restaurants.',
        },
        blocks: [
          {
            id: 'pricing-hero',
            type: 'hero',
            heading: 'One plan per business',
            subheading:
              'Pay per business, not per device. Add staff without adding invoices.',
          },
          {
            id: 'pricing-faq',
            type: 'faq',
            heading: 'Common questions',
            items: [
              {
                question: 'Can one account run several businesses?',
                answer:
                  'Yes. A mart, a pharmacy and a restaurant can sit under one login and bill independently.',
              },
              {
                question: 'What happens when a plan limit is reached?',
                answer:
                  'Invoicing keeps working until the billing period ends; upgrade at any time to raise the limit.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'about',
    status: 'published',
    translations: [
      {
        locale: 'en',
        title: 'About',
        navLabel: 'About',
        seo: { title: 'About — Creative Nepal' },
        blocks: [
          {
            id: 'about-body',
            type: 'richText',
            heading: 'Why we built this',
            markdown:
              'Creative Nepal started at a counter in Kathmandu, watching a shopkeeper reconcile a paper register against a spreadsheet at midnight.\n\nWe build billing software for the way Nepali businesses actually trade: mixed cash and digital payments, VAT that has to reconcile with the IRD, and stock that moves faster than any monthly stocktake can follow.',
          },
        ],
      },
    ],
  },
  {
    slug: 'terms',
    status: 'published',
    translations: [
      {
        locale: 'en',
        title: 'Terms of service',
        navLabel: 'Terms',
        seo: { title: 'Terms of service — Creative Nepal', noIndex: true },
        blocks: [
          {
            id: 'terms-body',
            type: 'richText',
            markdown:
              '## Terms of service\n\nReplace this placeholder from the admin dashboard before launch.\n\n### Accounts\n\nYou are responsible for the activity of every staff account you create.\n\n### Billing\n\nSubscriptions renew monthly until cancelled.',
          },
        ],
      },
    ],
  },
  {
    slug: 'privacy',
    status: 'published',
    translations: [
      {
        locale: 'en',
        title: 'Privacy policy',
        navLabel: 'Privacy',
        seo: { title: 'Privacy policy — Creative Nepal', noIndex: true },
        blocks: [
          {
            id: 'privacy-body',
            type: 'richText',
            markdown:
              '## Privacy policy\n\nReplace this placeholder from the admin dashboard before launch.\n\nWe store the business, invoice and staff records you enter, and use them only to run the service.',
          },
        ],
      },
    ],
  },
];

const SEED_NAVIGATION: Array<{
  locale: ContentLocale;
  header: ContentNavLink[];
  footer: ContentFooterGroup[];
  tagline: string;
  copyright: string;
}> = [
  {
    locale: 'en',
    header: [
      { id: 'nav-pricing', label: 'Pricing', href: '/pricing' },
      { id: 'nav-about', label: 'About', href: '/about' },
    ],
    footer: [
      {
        id: 'footer-product',
        label: 'Product',
        links: [
          { id: 'footer-pricing', label: 'Pricing', href: '/pricing' },
          { id: 'footer-about', label: 'About', href: '/about' },
        ],
      },
      {
        id: 'footer-legal',
        label: 'Legal',
        links: [
          { id: 'footer-terms', label: 'Terms', href: '/terms' },
          { id: 'footer-privacy', label: 'Privacy', href: '/privacy' },
        ],
      },
    ],
    tagline: 'Billing built for Nepali business.',
    copyright: 'Creative Nepal',
  },
  {
    locale: 'ne',
    header: [{ id: 'nav-pricing', label: 'मूल्य', href: '/pricing' }],
    footer: [
      {
        id: 'footer-legal',
        label: 'कानुनी',
        links: [
          { id: 'footer-terms', label: 'सर्तहरू', href: '/terms' },
          { id: 'footer-privacy', label: 'गोपनीयता', href: '/privacy' },
        ],
      },
    ],
    tagline: 'नेपाली व्यवसायका लागि बनेको बिलिङ।',
    copyright: 'क्रिएटिभ नेपाल',
  },
];

async function seedContent() {
  const db = getDb();

  for (const page of SEED_PAGES) {
    const [existing] = await db
      .select()
      .from(contentPages)
      .where(eq(contentPages.slug, page.slug))
      .limit(1);

    const pageId = existing?.id ?? randomUUID();

    if (existing) {
      await db
        .update(contentPages)
        .set({ status: page.status })
        .where(eq(contentPages.id, pageId));
      console.log(`Content page updated: ${page.slug}`);
    } else {
      await db.insert(contentPages).values({
        id: pageId,
        slug: page.slug,
        status: page.status,
        publishedAt: page.status === 'published' ? new Date() : null,
      });
      console.log(`Content page created: ${page.slug}`);
    }

    for (const translation of page.translations) {
      await db
        .insert(contentPageTranslations)
        .values({
          id: randomUUID(),
          pageId,
          locale: translation.locale,
          title: translation.title,
          navLabel: translation.navLabel,
          seo: translation.seo,
          blocks: translation.blocks,
        })
        .onConflictDoUpdate({
          target: [
            contentPageTranslations.pageId,
            contentPageTranslations.locale,
          ],
          set: {
            title: translation.title,
            navLabel: translation.navLabel,
            seo: translation.seo,
            blocks: translation.blocks,
            updatedAt: new Date(),
          },
        });
    }
  }

  for (const navigation of SEED_NAVIGATION) {
    await db
      .insert(contentNavigation)
      .values(navigation)
      .onConflictDoUpdate({
        target: contentNavigation.locale,
        set: {
          header: navigation.header,
          footer: navigation.footer,
          tagline: navigation.tagline,
          copyright: navigation.copyright,
          updatedAt: new Date(),
        },
      });
    console.log(`Navigation seeded: ${navigation.locale}`);
  }
}

seedContent()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

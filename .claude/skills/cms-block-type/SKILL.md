---
name: cms-block-type
description: >
  Add or change a CMS page block type (hero, features, richText, faq, cta, ...) in
  creative-nepal-api and coordinate the change across the web and admin repos. Use when a new
  block type is requested, when a block's fields change, or when a block payload is rejected
  by validation.
---

# CMS block contract — the API half, and the order of the rollout

A page body is an ordered array of **typed blocks** stored as JSONB. Never raw HTML: an author
must not be able to inject markup into the public site. The contract spans three repos and they
must move in this order, in separate PRs:

1. **here** — `src/database/schema/content.ts` and `src/modules/content/content.schema.ts`
2. `../web` — `src/features/content/types` + `components/block-renderer.tsx`
3. `../admin` — `src/features/content/types` + `schemas.ts`

The API first, always: the frontends compile against a shape the API already accepts, and the
renderer's exhaustive `switch` turns a missing renderer into a type error rather than a blank page.

## Steps in this repo

1. `src/database/schema/content.ts`
   - add the literal to `CONTENT_BLOCK_TYPES`
   - add the `ContentXBlock` interface with `type: '<name>'`
   - add it to the `ContentBlock` union
2. `src/modules/content/content.schema.ts`
   - add `const xBlockSchema = z.object({ id: blockId, type: z.literal('<name>'), ... })`
   - add it to the discriminated union
   - reuse the existing primitives — `href`, `imageUrl`, `blockId`, `shortText`, `longText`.
     **Any link field must use `href`**: that regex (site path, `http(s)`, `mailto`, `tel`, `#`)
     is what keeps `javascript:` URLs out of the database. Do not write a looser one.
3. Nothing to add in the DTOs: class-validator cannot express a discriminated union, so the
   write DTOs accept `unknown` and `ContentService` parses with the Zod schema. Keep it that way.
4. Migration: the column is JSONB, so a new block type needs **no** migration. A change to the
   surrounding columns does — see the `drizzle-schema-change` skill.
5. Seed/verify: `bun run db:seed:content`, then
   `bun run check-types && bun run lint && bun run test`.

## After the API lands

- Publishing pings `WEB_REVALIDATE_URL` (`ContentRevalidationService`, fire-and-forget), so a
  change reaches visitors without waiting out the web app's 5-minute window. If it doesn't,
  check `WEB_REVALIDATE_SECRET` matches on both sides.
- Draft preview relies on `CONTENT_PREVIEW_SECRET` arriving as `x-preview-secret`; the same
  value must be set in both frontend repos.
- Any author-visible label for the new block is an i18n key — `i18n-catalogue` skill.

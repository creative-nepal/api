---
name: i18n-catalogue
description: >
  Add, rename or remove a translation key in creative-nepal-api's i18n catalogues
  (src/i18n/en + src/i18n/ne), keeping the two locales key-for-key identical and using the
  `i18n:` marker for thrown errors. Use when a frontend needs a new user-visible string, when
  a service must throw a translated error, or when checking en/ne parity.
---

# i18n catalogues live here, for all three repos

`src/i18n/{en,ne}/` holds `common.json`, `errors.json`, `ui.json`. `ui.json` is every string the
web and admin interfaces render — the frontends fetch `GET /api/v1/i18n/:lang`, so **a key added
here is live for them with no frontend release**.

## Rules

- Add every key to **both** `en/` and `ne/` in the same edit. The two trees must be
  key-for-key identical; a key present in one only is a runtime raw-key on screen.
- Namespace by consumer: `ui.web.*` for the public site, `ui.admin.*` for the dashboard,
  shared vocabulary under `ui.action.*`, `ui.brand.*`, etc. Reuse an existing key before adding one.
- Placeholders are `{name}` and interpolate from the caller's payload.
- Never hardcode a user-visible string in a frontend component — that rule is enforced by
  review, not by the compiler.

## Throwing a translated error from a service

Services do **not** inject `I18nService`. Throw the key behind the `i18n:` marker and let
`HttpExceptionFilter` translate it:

```ts
throw new ForbiddenException({
  message: 'i18n:errors.invoice.quotaExceeded',
  limit,                       // interpolates {limit}
});
```

An argument value may itself carry the marker (`{ entity: 'i18n:common.entity.invoice' }`) so
nested labels localize too.

## Before finishing

```sh
bun .claude/skills/i18n-catalogue/scripts/check-parity.mjs   # en/ne key parity, exits 1 on drift
bun run check-types && bun run lint
```

The catalogues are JSON assets: `nest-cli.json`'s `assets` entry is what copies them into
`dist`. If translations are missing in a built container, check that entry before anything else.

## Sector and branch strings

- A sector's display name is `common.sector.<key>`, and `src/sectors/<key>/meta.ts` points at it
  via `nameKey`. Never hardcode a sector label in a frontend — both web and admin used to keep
  their own English `SECTOR_LABELS` map, which bypassed the catalogue and went stale the moment a
  sector was added. They now read this key.
- Role names are `common.role.<name>`; statuses `common.status.<value>`. A new sector role or
  status needs its key here in the same change, or the UI renders the raw enum.

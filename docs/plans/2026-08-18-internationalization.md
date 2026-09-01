# Multi-Sector Billing SaaS — Internationalization (English + Nepali)

Server-driven i18n across the API and both web frontends. Two languages only:
`en` (fallback) and `ne`.

## Context

The product bills Nepali shops against IRD rules, and the printed artefacts
(tax invoice, Bikri Khata, Kharid Khata) are already Devanagari. The
*application* around them was not. Nothing else in the stack knew a language
existed.

"Server-driven" is the constraint that shapes the rest: the catalogue lives in
the API, not duplicated into `apps/web` and `apps/admin`. A string is added
once. The frontends fetch it.

## 1. Where a message can come from

Three sources, and they need different machinery — which is why this is not
just "add a JSON file":

1. **Domain errors** thrown by our own services (`quotaExceeded`,
   `dispenseOnly`, `buyerPanRequired`). Ours to translate.
2. **Better Auth errors** (`INVALID_EMAIL_OR_PASSWORD`, …). Raised inside the
   library, never passing through our exception filter.
3. **UI chrome** — labels, sector names, statuses, invoice headings. Rendered
   by React, so it needs the catalogue as *data*, not as thrown messages.

## 2. Domain errors — a marker, not a wrapper

Services do not take an `I18nService` dependency. They throw a **key** behind an
`i18n:` marker:

```ts
throw new ForbiddenException({
  message: 'i18n:errors.invoice.quotaExceeded',
  limit,
});
```

`HttpExceptionFilter` is the single place that translates. It resolves the key
against the request's language, then substitutes `{placeholder}` from the
remaining properties of the thrown payload.

Two consequences worth stating:

**The filter had to become injectable.** It was `new`-ed at bootstrap; it is now
`app.get(HttpExceptionFilter)` so Nest can hand it `I18nService`.

**Interpolation is ours, not the library's.** `nestjs-i18n`'s formatter did not
substitute our arguments, so the filter does the `{name}` replacement itself —
a two-line regex against a payload we already hold. Fewer moving parts than
diagnosing a formatter we do not otherwise use.

### Arguments are translatable too

`"this business is {actual}"` interpolated the raw slug, so a Nepali sentence
ended in the English word `mart`. An argument value may therefore itself carry
the `i18n:` marker:

```ts
actual: `i18n:common.sector.${business.sector}`,
```

The same convention, one level deeper — so the Nepali message reads
`यो व्यवसाय पसल हो`, not `… mart हो`.

## 3. Better Auth — its own plugin

Better Auth raises its errors internally, so `better-auth-localization` handles
them, with a Nepali catalogue keyed by Better Auth's own error codes and a
`getLocale` that reads `x-language` then `accept-language`.

Both frontends' `authClient` sets `x-language` in a `fetchOptions.onRequest`
hook — auth requests do not go through the Axios instance, so without this the
language switcher would silently not apply to sign-in errors.

## 4. Resolution order

`QueryResolver('lang')` → `HeaderResolver('x-language')` → `AcceptLanguageResolver`,
falling back to `en`. The query parameter exists so a translated page can be
linked or curl'd without header plumbing; the header is what the apps send; the
browser's `accept-language` is the honest default for a user who has chosen
nothing.

## 5. The catalogue endpoint

- `GET /v1/i18n/languages` → `[{code, label}]`, each label **in its own
  language** (`English`, `नेपाली`) — a language picker that names languages in a
  language you cannot read is useless.
- `GET /v1/i18n/:lang` → `{lang, common, errors}`; unsupported → 404 rather
  than a silent fallback, so a typo is visible instead of quietly English.

Both anonymous: the login screen needs them before a session exists.

Frontends consume this through a `features/i18n/` folder in each app, matching
the established `constants/ types/ hooks/ components/ services.ts queries.ts`
layout. `I18nProvider` exposes `t(key, vars)` doing the same dotted-key lookup
and `{name}` interpolation as the server. The chosen language is a persisted
Zustand store, read by `lib/api.ts` so **every** request carries `x-language`.

## 6. Deliberately not translated

**class-validator messages** (`"quantity must be a whole number"`). Doing this
properly means `i18nValidationMessage()` on ~350 decorator sites; the cheap
alternative splices an English constraint fragment into a Nepali sentence,
which reads worse than clean English. Both frontends validate with their own
Zod schemas, so these are a direct-API-misuse fallback, not a user-facing path.

**Devanagari numerals for interpolated values.** Static thresholds in the
catalogue use them (`रु. १०,०००`); dynamic arguments stay ASCII. Transliterating
digits in a generic filter would corrupt the UUIDs that several messages
interpolate.

**Entity 404s beyond business and invoice.** Those two are wired; the other
~40 (`Order … not found`) are not, since the frontends render their own empty
states for a 404 rather than the server's string.

## 7. Status

> **Built and verified against the production artifact** (`node dist/main.js`),
> not only under `ts-node`.
>
> Confirmed: `{limit}` interpolates in both languages; a translatable argument
> renders `यो व्यवसाय पसल हो` rather than leaking the slug; all three resolvers
> (`?lang=`, `x-language`, `accept-language`) select Nepali; an unknown language
> falls back to English and `GET /v1/i18n/fr` is a 404; Better Auth returns
> `इमेल वा पासवर्ड मिलेन` for a bad password.
>
> The catalogue and the code are kept in exact correspondence: 20 error keys,
> none unreferenced, both locales complete.
>
> **Two production bugs this phase exposed and fixed:**
>
> `nest-cli.json` gained an `assets` entry — the catalogue is JSON, which `tsc`
> does not emit, so a built image would have served bare keys.
>
> More seriously, `start:prod` runs `node dist/main`, but `drizzle.config.ts`
> sitting at the package root pulled `tsc`'s inferred `rootDir` up a level and
> emitted `dist/src/main.js`. **The built API could not start at all**, on
> `main` as well — masked because every check so far ran the dev server.
> `tsconfig.build.json` now excludes that file; nothing imports it (`drizzle-kit`
> reads the `.ts` directly), and the fix also lands the i18n assets beside the
> compiled module they are loaded relative to.

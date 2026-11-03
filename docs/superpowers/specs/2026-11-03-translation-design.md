# Translation (en / fr)

The Translation slice in `docs/roadmap.md`: every screen's copy in English and French, a language choice
in personal settings, dates and amounts formatted for the chosen language.

## Why

- **French** is for the owner's friends, the people who actually use the instance.
- **English** stays because Ardoise is open source: it is the reference language of the project.
- Today the app is English only, and dates and amounts are formatted with a hardcoded `en` / `en-GB`
  (`day-label.ts`, `money-amount.ts`, `money-input.ts`, `admin-dates.ts`, `app-version.ts`).

## Goals

- Every piece of copy in the frontend exists in English and French: visible text, `aria-label`s,
  placeholders, sheet titles, error lines, the document `<title>` if the app sets one.
- On first launch the language follows the device: `navigator.languages`, first entry whose primary
  subtag is `fr` gives French, otherwise English. This includes the accept-invite page a friend opens
  before having an account.
- In Settings, a Language choice: System / English / Français. It applies at once, without reload, and
  is remembered on the device, like the theme.
- Dates and amounts follow the active language (`3 nov. 2026`, `1 234,56 €` in French; `3 Nov 2026`,
  `€1,234.56` in English).
- French copy uses **vous** (owner: "le vouvoiement fera plus sobre").
- Translation mistakes fail `pnpm verify`, not production (see Robustness).

## Non-goals

- A third language. The setup must make one easy to add (a file plus an entry in the language list), but
  none is added now.
- Syncing the language across devices. It stays in localStorage, per device (owner).
- Translating user content: group names, payment titles, member names.
- Translating demo or seed data.
- Backend copy. The backend sends no user-facing text today: the frontend owns every message, errors
  included. Nothing to translate in NestJS.

## Anti-goals

- Three sources of locale that drift apart (Transloco in French, a `DatePipe` still in English). There is
  one source of truth: Transloco's active language. Everything else derives from it.
- A screen that shows raw keys (`settings.theme.title`) or flashes English before switching to French on
  load.
- Sentences assembled from fragments (`count + ' members'`). Plurals and variables go through ICU.

## Decided by the owner

- Library: **Transloco** (`@jsverse/transloco`, 8.x, peer `@angular/core >=16`, fine with Angular 22),
  runtime translation, one build. Not `@angular/localize`.
- Stay inside the Transloco ecosystem and make it as robust as possible, typing included.
- **No date-fns, no Angular `DatePipe` / `CurrencyPipe` / dynamic `LOCALE_ID`.** Formatting goes through
  `Intl`, fed by the active language.
- Language is per device, like the theme.
- Picker options are written in their own language: "English", "Français". "System" is translated.
- Vouvoiement.
- Amount and percent inputs show a point in English and a comma in French, and accept both on input.

## Architecture

### Packages

- `@jsverse/transloco`: runtime, `*transloco="let t"` / `transloco` pipe, `TranslocoService`.
- `@jsverse/transloco-messageformat`: ICU plurals and selects (`{count, plural, one {# membre} other {#
  membres}}`).
- `@jsverse/transloco-keys-manager` (dev): `find` mode in `pnpm verify`.
- `@jsverse/transloco-locale` is **optional**: the builder uses it only if its pipes fit the existing
  `Intl` helpers better than a small `computed` on the active language. The rule that matters is that
  formatting reads the active language, never a constant.

### Translation files

- `apps/frontend/src/assets/i18n/en.json` and `fr.json` (path is the builder's call), nested by feature
  (`settings.*`, `payment.form.*`, `balance.*`, ...). JSON, not TS, because keys-manager reads JSON and a
  contributor adding a language only drops a file.
- `en.json` is the reference.
- Loaded with a Transloco loader through dynamic `import()` of the JSON, so each language is its own lazy
  chunk. The app has no service worker. A translation chunk that fails to load is not recovered:
  `version-watcher.ts` only reloads on router navigation errors and on a visible-again sha change.
  The window is narrow (switching language after a deploy, before the tab was hidden and shown
  again); hardening it is left for later.

### Robustness (typing)

Four layers, each catching what the previous one cannot:

1. **Parity at compile time.** A type-only file imports both JSON files (`resolveJsonModule`) and asserts
   that the set of deep key paths of `fr` equals that of `en`, both directions. A missing or extra key in
   `fr.json` fails `pnpm typecheck`. Example shape: `type Paths<T>` (dot paths of string leaves) and an
   `Equal<Paths<typeof en>, Paths<typeof fr>>` assertion. Exact helper is the builder's call.
2. **Used keys exist.** keys-manager `find` runs in `pnpm verify` (and so in CI). It extracts every key
   used in templates and TS and fails on a key missing from the translation files and on an unused key
   (`--emit-errors-on-extra-keys` or equivalent).
3. **Missing key at runtime.** A custom `TranslocoMissingHandler` throws in dev and in tests, so a vitest
   spec that renders a missing key fails. In production it falls back to English
   (`fallbackLang: 'en'`, `missingHandler.useFallbackTranslation`). With layers 1 and 2 this should
   never happen.
4. **ICU syntax.** A unit spec parses every value of both files with the messageformat compiler, so a
   broken `{count, plural, ...}` fails a test instead of a screen.

What is not typed: the argument of `t('...')` stays a `string` at the call site. Layer 2 covers it in CI.

### Language state

A `LanguageService` in `src/app/shared/` (folder is the builder's call), modelled on `ThemeService`:

- `preference`: `'system' | 'en' | 'fr'`, read from and written to localStorage key `ardoise.language`,
  with the same try/catch around storage.
- `resolved`: `'en' | 'fr'`, `computed` from the preference and `navigator.languages`. It listens to the
  `languagechange` event so System follows a device change live.
- An `effect` sets Transloco's active language and `document.documentElement.lang`.
- `setPreference(preference)`.

The supported languages live in one list (code, native name, fallback formatting locale) that the
picker, the resolver and the parity check all read. Language and formats are separate, like on the
OS: the formatting locale is the first device language whose primary subtag is the active language
(`en-US`, `fr-CH`...), and only without one does it fall back to `en-GB` / `fr-FR`. It follows a
device change live. There is no format override in Settings (owner, option 2). Adding a language means adding a file and an entry.

### Boot without flash

`provideAppInitializer` waits for the resolved language's file to load before the first render
(`translocoService.load(lang)` or Transloco's preload). No key or English flash on a French device.
`index.html` keeps `lang="en"` as the static default. The effect corrects it on boot.

### Formatting

The pure helpers take the locale as a parameter instead of a constant, and stay pure:

- `day-label.ts`: `shortDay(iso, locale)`, `dayLabel(date, today, locale)`. "Today" / "Yesterday" become
  either translation keys or `Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`, which gives
  "aujourd'hui" / "hier". This is the builder's call. Pick one and use it everywhere.
- `money-amount.ts`: the `computed` reads the active language. The minus sign and `+` rules stay as they
  are.
- `money-input.ts`: `formatAmountInput` and `formatPercentInput` use the language's decimal separator:
  point in English (`24.50`), comma in French (`24,50`). Today they always write a comma, so this is a
  visible change in English, chosen by the owner. Parsing keeps accepting both separators in both
  languages (owner). A thousands separator is still rejected (`1,234` has three decimals and fails as
  today), which avoids reading it as 1.234.
- `admin-dates.ts`, `app-version.ts`: same treatment. They also assemble English phrases themselves
  ("joined 3 days ago", "1 group", "Version ..."). Those become translation keys with ICU, either by
  returning structured values the template translates or by taking a translate function. Builder's call.
- `Intl.*Format` instances are cached per locale, not rebuilt on every call.

**Default payment title.** `defaultTitle(date)` (`"Payment, 3 Nov"`) becomes translated and
locale-formatted (`"Paiement, 3 nov."`). It is **stored** in the database, so it keeps the creator's
language for everyone afterwards. That is user content, like a typed title, and is not re-translated.
(My call.)

### Known limit

The date field in the payment options step is a native `<input type="date">`. Its display follows the
browser's language, not the app's. Nothing in the app can change that, so it is accepted.

## Screens

### Settings: Language

A new section between **Theme** and **Sign out**, built like Theme:

- Eyebrow "Language" / "Langue".
- A three-option toggle group: System (translated: "Système") / English / Français, showing the current
  preference. Selecting one calls `LanguageService.setPreference`. The whole screen switches at once.
  There is no save button.

Tap count to switch language from home: 1 (gear) + 1 (option).

### Every other screen

There are no layout changes. All copy moves to keys. French strings run about 15–30% longer. Any row,
button or header that truncates or wraps badly in French is fixed with the existing layout tools: no new
arbitrary values, and copy can be shortened before layout changes.

## Copy

- English copy is the current copy, unchanged, moved to `en.json`.
- French is written by the builder: vous, sober tone. The existing vocabulary decisions in
  `docs/design.md` carry over (code says settlement, the screen says "Repayment", in French
  "Remboursement").
- A short glossary for the recurring words (group, member, payment, repayment, balance, share, invite
  link, passkey) goes in `docs/design.md`, so later slices stay consistent. Example: passkey → "clé
  d'accès", the term Apple and Google use in French.

## Tests

Following `docs/testing.md`:

- **Pure formatting specs**: `dayLabel`, `shortDay`, `formatAmountInput`, `formatPercentInput`,
  `defaultTitle`, money formatting, admin dates, each asserted in `en` and `fr`.
- **Translation files spec**: every value compiles as ICU (layer 4).
- **`LanguageService` spec**, mirroring `ThemeService`'s: default system resolution from
  `navigator.languages` (fr-CA → fr, de → en), stored preference wins, `languagechange` followed live,
  `<html lang>` set, unreadable storage falls back to system.
- **Existing component specs** keep asserting English text. A shared test provider gives Transloco the
  real `en.json` synchronously, with the throwing missing handler. Each spec changes only its providers.
- **Settings spec**: the Language toggle shows the current preference and calls `setPreference`.
- **Playwright**: Chrome is pinned to `locale: 'en-US'` in both configs so existing scenarios stay
  deterministic. One new scenario, "switch the app to French": open Settings, pick Français, the
  screen reads in French, reload, it is still French. A second, "a French device opens in French": a
  context with `locale: 'fr-FR'` opens an invite link and sees the accept-invite page in French.
- **Screenshots**: the matrix gains a language dimension. Its `ready` checks and clicks match English
  text today, so they become language-aware. Every screen and state is captured in English
  as today, plus French in light at 393×852, which is where longer copy breaks. (My call: French dark
  adds nothing that light does not show.)
- `apps/backend/scripts/seed-dev.ts`: nothing to add, this slice has no new data.

## My calls

- JSON translation files instead of the TS files floated in the conversation, because keys-manager only
  reads JSON. Typing comes from the compile-time parity check instead.
- `fr` for any `fr-*` device language, English for everything else.
- The Language section placed between Theme and Sign out.
- Default payment title is translated at creation and then stored as is.
- French screenshots in light only.
- Passkey → "clé d'accès".

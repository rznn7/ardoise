# Translation (en / fr) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every frontend screen in English and French, a per-device language choice in Settings, dates and amounts formatted for the active language.

**Architecture:** Transloco at runtime, with JSON translation files loaded lazily. One `LanguageService`, modelled on `ThemeService`, is the single source of truth. It exposes a `Translator` signal (`translate` + Intl `locale`). Templates use Transloco's `*transloco` directive, and pure helpers receive a `Translator` as a parameter. Robustness has four layers: tsc parity between `fr.json` and `en.json`, typed keys in TS (`TranslationKey`), keys-manager `find` in lint for templates and unused keys, and a missing-key handler that throws in dev and tests.

**Tech Stack:** Angular 22, `@jsverse/transloco` 8.4, `@jsverse/transloco-messageformat` 8.4, `@jsverse/transloco-keys-manager` 8.1 (dev), `@messageformat/core` (dev, ICU spec), vitest via `@angular/build:unit-test`, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-translation-design.md`

## Global Constraints

- No date-fns, no Angular `DatePipe` / `CurrencyPipe` / `DecimalPipe`, no dynamic `LOCALE_ID`. All formatting uses `Intl` with the active language's formatting locale.
- Languages: `en` (formatting locale `en-GB`) and `fr` (formatting locale `fr-FR`). `en.json` is the reference.
- Device resolution: the first entry of `navigator.languages` whose primary subtag is `fr` gives `fr`. Everything else gives `en`.
- Storage key `ardoise.language`, values `system | en | fr`, every access wrapped in try/catch (same as `ThemeService`).
- French uses **vous**, in a sober tone. Picker labels: "System"/"Système" is translated, "English" and "Français" are not.
- English copy is today's copy, unchanged.
- Plurals and variables use ICU with single braces (`{count, plural, one {# group} other {# groups}}`, `{name}`). Never concatenate fragments.
- Amount and percent inputs: point in English (`24.50`, `10.5`), comma in French (`24,50`, `10,5`). Parsing accepts both separators in both languages, unchanged.
- The default payment title is translated and formatted at creation, then stored as is.
- In TS, every key goes through a call to a function named `translate` (that is what keys-manager extracts) and is typed `TranslationKey`.
- Template rules from `CLAUDE.md` still apply: no new arbitrary values, no type-scale classes. When French copy overflows, shorten the copy before touching the layout.
- One translation file per language, no Transloco scopes: keys are namespaced by feature folder (`admin.*`, `payment.*`), so splitting into scopes later is mechanical.
- Commit messages: one line, no body, no trailers.

## Review Focus

1. **Switching language while a screen is open.** Labels computed in TS (feed day headers, repayment rows, payment meta, admin lines, version footer) must recompute. They read `language.translator()` inside their `computed`. A helper result cached outside a `computed` would stay in the old language. Test: Task 2 settings spec switches to `fr` and asserts the version footer changes.
2. **A French device opening the app cold.** No English flash, no raw keys. `provideAppInitializer` awaits the language load. Test: the Task 6 scenario "a French device opens in French".
3. **Editing a payment created in the other language.** Its stored title stays as typed. Its amount text is reformatted in the current language's separator, and both separators still parse. Test: Task 3 `money-input.spec.ts`, round trip `formatAmountInput(2450, 'fr-FR')` → `parseAmount('24,50')` and en → `'24.50'`.
4. **`System` follows a device language change live.** Test: Task 2 `languagechange` spec.
5. **Storage unavailable** (private mode, blocked). It falls back to `system` without throwing. Test: Task 2 spec with throwing `localStorage`.

---

## File Structure

```
apps/frontend/
  transloco.config.ts                         keys-manager config (rootTranslationsPath, langs, unflat)
  src/i18n/en.json, fr.json                   translations, nested by feature
  src/app/shared/i18n/
    languages.ts                              LANGUAGES list, Language, LanguagePreference, resolveLanguage
    translation-key.ts                        TranslationKey, TranslationParams, Translate, Translator
    translation-parity.ts                     type-only assertion fr ≡ en
    transloco-loader.ts                       lazy import() loader
    strict-missing-handler.ts                 throws in dev, falls back in prod
    provide-i18n.ts                           provideI18n() for app.config
    language.service.ts (+ spec)              preference, resolved, translator, setPreference
    translations.spec.ts                      every value compiles as ICU
  src/test-providers.ts                       providersFile for the unit-test builder
```

---

### Task 1: Transloco foundation and typed keys

**Files:**
- Modify: `apps/frontend/package.json` (deps, `lint` script), `apps/frontend/angular.json` (test `providersFile`), `apps/frontend/tsconfig.json` (`resolveJsonModule: true`), `apps/frontend/src/app/app.config.ts`
- Create: everything under `src/app/shared/i18n/` except `language.service.ts`, `src/i18n/en.json`, `src/i18n/fr.json`, `src/test-providers.ts`, `transloco.config.ts`
- Modify: `docs/design.md` (glossary)

**Interfaces:**
- Produces:
  - `type Language = 'en' | 'fr'`, `type LanguagePreference = 'system' | Language`
  - `LANGUAGES: readonly { code: Language; nativeName: string; formatLocale: string }[]` = `[{ code: 'en', nativeName: 'English', formatLocale: 'en-GB' }, { code: 'fr', nativeName: 'Français', formatLocale: 'fr-FR' }]`
  - `resolveLanguage(preference: LanguagePreference, deviceLanguages: readonly string[]): Language`
  - `formatLocaleOf(language: Language): string`
  - `type TranslationKey` (dot paths of string leaves of `typeof en`), `type TranslationParams = Readonly<Record<string, string | number>>`
  - `type Translate = (key: TranslationKey, params?: TranslationParams) => string`
  - `interface Translator { readonly translate: Translate; readonly locale: string }`
  - `provideI18n(): EnvironmentProviders`
  - `translatorFor(language: Language): Translator`, exported from `src/test-providers.ts` for pure specs: reads the preloaded test Transloco through `TestBed.inject`

- [ ] **Step 1: Install**

Run: `pnpm --filter @ardoise/frontend add @jsverse/transloco@8.4.0 @jsverse/transloco-messageformat@8.4.0 && pnpm --filter @ardoise/frontend add -D @jsverse/transloco-keys-manager@8.1.1 @messageformat/core`
Expected: installed, `pnpm --filter @ardoise/frontend build` still green.

- [ ] **Step 2: Glossary in `docs/design.md`**

Add a `## Copy` section after `## Template rules`: English is the reference, French uses vous in a sober tone, ICU for plurals. Then this glossary, which every later task uses:

| English | Français |
|---|---|
| group | groupe |
| member | membre |
| payment | paiement |
| repayment | remboursement |
| balance | solde |
| share (split part) | part |
| invite link | lien d'invitation |
| passkey | clé d'accès |
| settled up | à jour |
| Settings | Réglages |

- [ ] **Step 3: Write `src/i18n/en.json` / `fr.json` with the first keys**

Start with `common.today`, `common.yesterday`, `common.someone`, and `settings.language.title` ("Language" / "Langue"), `settings.language.system` ("System" / "Système"). Later tasks add their own keys.

- [ ] **Step 4: Write the failing specs**

`languages.spec.ts`:
```ts
expect(resolveLanguage('system', ['fr-CA', 'en'])).toBe('fr');
expect(resolveLanguage('system', ['de-DE', 'fr'])).toBe('fr');
expect(resolveLanguage('system', ['de-DE'])).toBe('en');
expect(resolveLanguage('system', [])).toBe('en');
expect(resolveLanguage('en', ['fr-FR'])).toBe('en');
expect(formatLocaleOf('fr')).toBe('fr-FR');
```
The second case reads "first entry whose primary subtag is `fr`" literally: it scans the whole list. Keep it literal.

`translations.spec.ts`: for each language in `LANGUAGES`, flatten the file, `new MessageFormat(formatLocale).compile(value)` must not throw for any leaf. Also check that `translatorFor('fr').translate('common.today')` returns `"Aujourd'hui"`.

- [ ] **Step 5: Run, expect FAIL** — `pnpm --filter @ardoise/frontend test`, modules missing.

- [ ] **Step 6: Implement the i18n files**

- `translation-key.ts`: `TranslationKey` built with a recursive `Paths<T>` over `typeof import('src/i18n/en.json')`.
- `translation-parity.ts`: assert `Equal<Paths<typeof en>, Paths<typeof fr>>` in both directions, so a missing or extra key fails `tsc`. Make sure the file is included by `tsconfig.app.json`, for example by importing it from `provide-i18n.ts` as a type-only import.
- `transloco-loader.ts`: `getTranslation(lang)` → `from(import(\`../../../i18n/${lang}.json\`).then(m => m.default))`.
- `strict-missing-handler.ts`: implements `TranslocoMissingHandler`. When `isDevMode()`, it throws `Error(\`Missing translation: ${key}\`)`. Otherwise it returns the key, because the fallback handles the rest.
- `provide-i18n.ts`: `provideTransloco({ config: { availableLangs: ['en', 'fr'], defaultLang: 'en', fallbackLang: 'en', reRenderOnLangChange: true, prodMode: !isDevMode(), missingHandler: { useFallbackTranslation: true } }, loader })`, `provideTranslocoMessageformat()`, and the custom missing handler.
- Add `provideI18n()` to `app.config.ts`.
- `src/test-providers.ts`: the default export is the provider array used by `TranslocoTestingModule.forRoot({ langs: { en, fr }, preloadLangs: true, translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'en' } })` plus messageformat and the strict missing handler. Register it as `providersFile` in `angular.json` under `test.options`. Existing component specs then render real English with no change.

- [ ] **Step 7: keys-manager**

`transloco.config.ts`: `rootTranslationsPath: 'src/i18n/'`, `langs: ['en', 'fr']`, `keysManager: { input: ['src/app'], unflat: true }`. Add a `i18n:check` script running `transloco-keys-manager find --emit-errors-on-extra-keys` (confirm the exact flag with `--help`). Run it once: it must report the Step 3 keys as unused, which proves it works. Task 2 chains it into `lint` once those keys are used.

- [ ] **Step 8: Verify** — `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck` pass. Temporarily delete a key from `fr.json`, confirm `typecheck` fails, then restore it.

- [ ] **Step 9: Commit** — `git commit -m "feat(i18n): transloco with typed keys, parity check and ICU"`

---

### Task 2: LanguageService, boot, Settings language section

**Files:**
- Create: `src/app/shared/i18n/language.service.ts`, `language.service.spec.ts`
- Modify: `src/app/app.config.ts`, `src/app/settings/settings.{ts,html,spec.ts}`, `src/i18n/*.json`, `apps/frontend/package.json` (lint)

**Interfaces:**
- Consumes: Task 1 `resolveLanguage`, `formatLocaleOf`, `Translator`, `LANGUAGES`
- Produces: `LanguageService` (`providedIn: 'root'`):
  - `readonly preference: Signal<LanguagePreference>`
  - `readonly active: Signal<Language>` (changes only after that language is loaded)
  - `readonly translator: Signal<Translator>` (`computed` on `active`; `translate` calls `TranslocoService.translate(key, params, lang)`)
  - `setPreference(preference: LanguagePreference): void`
  - `ready(): Promise<void>` (resolves once the initial language is loaded)
  - exported `LANGUAGE_STORAGE_KEY = 'ardoise.language'`

- [ ] **Step 1: Failing spec `language.service.spec.ts`**, mirroring `theme.service.spec.ts`. Stub `navigator.languages` with `vi.spyOn(navigator, 'languages', 'get')`.
  - defaults to `system`, and resolves `fr` from `['fr-BE']`: `await service.ready()`, then `active()` is `'fr'` and `document.documentElement.lang === 'fr'`
  - a stored `en` wins over a French device
  - `setPreference('fr')` stores `'fr'`, and after `ready`/flush `active()` is `'fr'` and `translator().translate('common.today')` is `"Aujourd'hui"`, `translator().locale` is `'fr-FR'`
  - `system` follows `languagechange`: switch the stub to `['fr']`, dispatch `new Event('languagechange')` on `window`, and `active()` becomes `'fr'`
  - throwing `localStorage.getItem` / `setItem` → `preference()` is `'system'`, `setPreference` does not throw

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `LanguageService`.** An `effect` on the resolved language calls `transloco.load(lang)`, then sets the `active` signal, calls `transloco.setActiveLang(lang)` and sets `document.documentElement.lang`. Read storage like `ThemeService`. In `app.config.ts`, the initializer `return inject(LanguageService).ready()` (alongside the existing theme/version lines).

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Settings section.** Between the Theme section and the Sign out row, add a `section` with `aria-labelledby="language-heading"`. It holds an eyebrow `t('settings.language.title')` and a `hlmToggleGroup` built like Theme, bound to `language.preference()`, with items `system` (`t('settings.language.system')`) and one per `LANGUAGES` entry showing `nativeName` untranslated. Translate the whole settings template in the same step (`*transloco="let t"` on the root), and the version footer through Task 3's `versionLabel`. In `settings.spec.ts`, check that the toggle shows the stored preference, that clicking "Français" calls `setPreference('fr')`, and that after switching the heading reads "Réglages". The Review Focus 1 test: with a mocked `/version.json` (`{ sha: 'a1b2c3d4', date: '2026-11-03' }`), the footer reads `Version a1b2c3d · 3 Nov 2026`, then `Version a1b2c3d · 3 nov. 2026` after clicking "Français", without reloading the component.

- [ ] **Step 6: Chain keys-manager into lint.** `lint` becomes `eslint src scripts && tsx scripts/check-component-css.ts && pnpm i18n:check`. Any Task 1 key nothing uses yet (`common.*` is consumed in Task 3) is removed now and re-added in Task 3. Run `pnpm --filter @ardoise/frontend lint`, expected green.

- [ ] **Step 7: Commit** — `git commit -m "feat(i18n): language preference per device, picker in settings"`

---

### Task 3: Locale-aware pure helpers

Every helper that formats or composes copy takes the active language explicitly. Components feed it from `language.translator()` inside their existing `computed`s, so a switch recomputes them (Review Focus 1).

**Files:**
- Modify and extend specs: `payment/day-label.ts`, `payment/money-input.ts`, `payment/payment-meta.ts`, `settlement/settlement-label.ts`, `balance/balance-rows.ts`, `admin/admin-dates.ts`, `shared/version/app-version.ts`, `shared/ui/money-amount/money-amount.ts`, and their callers (`group-page.ts`, `group-balances.ts`, `settlement-details.ts`, `payment-details.ts`, `payment-draft.ts`, `title-step.ts`, `options-step.ts`, `admin-*.ts`, `settings`)
- Modify: `src/i18n/*.json`

**Interfaces:**
- Consumes: `Translator`, `LanguageService.translator`; specs use `translatorFor(lang)`
- Produces (new signatures):
  - `shortDay(iso: string, locale: string): string`
  - `dayLabel(date: Date, today: Date, tr: Translator): string` (keys `common.today` / `common.yesterday`)
  - `formatAmountInput(cents: number, locale: string): string`, `formatPercentInput(basisPoints: number, locale: string): string`. The decimal separator comes from `Intl.NumberFormat(locale).formatToParts(1.1)`, and there is no thousands grouping
  - `defaultTitle(date: Date, tr: Translator): string` (key `payment.defaultTitle`: "Payment, {date}" / "Paiement, {date}")
  - `paymentMeta(payment, members, meUserId, tr: Translator): string`
  - `settlementLabel(parties, members, meUserId, tr: Translator): string`
  - `repaymentRows(transfers, members, meUserId, pending, tr: Translator)`, `doneRows(settlements, members, meUserId, tr: Translator)`
  - `signedInLabel(lastSignInAt, createdAt, now, tr)`, `expiresIn(iso, now, tr)`, `groupsLabel(count, tr)`, `groupMeta(group, tr)`, `shortDate(iso, locale)`
  - `versionLabel(body: unknown, tr: Translator): string`. `AppVersion` stores the parsed `{ sha, date } | null` and exposes `label = computed(...)` over `LanguageService.translator()`
  - `MoneyAmount.formatted` uses `language.translator().locale`
  - `Intl` formatters cached per locale (`Map<string, Intl.DateTimeFormat>`), not rebuilt per call

- [ ] **Step 1: Extend each spec with a French case next to the English one.** Exact values to assert:
  - `shortDay('2026-11-03T10:00:00Z', 'en-GB')` → `'Tue 3 Nov'`; `'fr-FR'` → `'mar. 3 nov.'`
  - `dayLabel(today, today, translatorFor('fr'))` → `"Aujourd'hui"`; yesterday → `'Hier'`
  - `formatAmountInput(2450, 'en-GB')` → `'24.50'`; `'fr-FR'` → `'24,50'`; `formatPercentInput(1050, 'en-GB')` → `'10.5'`; `'fr-FR'` → `'10,5'`; `formatAmountInput(123456, 'fr-FR')` → `'1234,56'` (no grouping)
  - round trip (Review Focus 3): `parseAmount(formatAmountInput(2450, l))` is `2450` for both locales
  - `defaultTitle(new Date(2026, 10, 3), translatorFor('fr'))` → `'Paiement, 3 nov.'`
  - `settlementLabel` fr: `'Vous avez remboursé Léa'`, `'Léa vous a remboursé'`, `'Léa a remboursé Tom'`
  - `repaymentRows` fr labels: `'Vous devez à Léa'` / confirm `"J'ai remboursé Léa"`; `'Léa vous doit'` / `"Léa m'a remboursé"`; `'Léa doit à Tom'`
  - `paymentMeta` fr: `'Payé par vous · mar. 3 nov. · Équitable'`
  - `groupsLabel(0|1|3, fr)` → `'Aucun groupe' | '1 groupe' | '3 groupes'`; `expiresIn` fr → `"expire aujourd'hui" | 'expire demain' | 'expire dans 3 jours'`
  - `versionLabel({ sha: 'a1b2c3d4', date: '2026-11-03' }, translatorFor('fr'))` → `'Version a1b2c3d · 3 nov. 2026'`
  - `MoneyAmount` with the language set to `fr`: `123456` EUR → `'1 234,56 €'` (narrow no-break space as Intl emits; assert with `toMatch(/^1\s234,56\s€$/u)`)
  - Existing English assertions stay as they are. Only the extra argument (`translatorFor('en')`, `'en-GB'`) is added. One expected English change: `formatAmountInput` now gives `24.50`.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement the signatures above, add their keys to both JSON files (ICU for counts), and update the callers** so each one reads `this.language.translator()` inside the `computed` that already calls the helper. `PaymentDraft` injects `LanguageService` for `formatAmountInput` / `formatPercentInput` / `defaultTitle`. Toasts (`'This payment was deleted'`, `'This repayment was undone'`) and `login.ts`'s `'Login failed.'` go through `translator().translate`.

- [ ] **Step 4: Run** `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend lint`, expected green.

- [ ] **Step 5: Commit** — `git commit -m "feat(i18n): dates, amounts and composed labels follow the active language"`

---

### Task 4: Translate templates — entry and group screens

**Files:** templates and their TS (aria-labels, inline templates) for `app.html`, `auth/**`, `invite-link/**`, `home/**`, `expense-group/**`, `balance/**`, `settlement/**`, `shared/ui/**` (`mobile-shell`, `refresh-indicator`, `stepper`, `page-state`, `load-more`, `balance-indicator`, any building block with copy), `group-page.ts` strings (`'You owe'`, `'Owed to you'`, `'Settled up'`, `'Just you so far'`). Update `src/i18n/*.json` as you go.

**Interfaces:**
- Consumes: `*transloco="let t"` in templates; `LanguageService.translator()` in TS
- Produces: keys namespaced by folder (`auth.*`, `invite.*`, `home.*`, `group.*`, `balance.*`, `settlement.*`, `ui.*`)

- [ ] **Step 1:** In each template, wrap the root in `<ng-container *transloco="let t">` and replace every literal (text, `aria-label`, `placeholder`, `title`) with `t('…')`. Dynamic parts become ICU params (`t('ui.stepper.fewer', { name: label() })`). Building blocks under `shared/ui` that take a label input keep taking it. Only their own built-in copy moves to keys.
- [ ] **Step 2:** Write the French copy with the glossary and vous. Examples that fix the tone: "No groups yet" → "Aucun groupe pour l'instant"; "All settled" → "Tout est réglé"; "You owe" → "Vous devez"; "Owed to you" → "On vous doit"; "Settled up" → "À jour"; "New here? Join with a passkey" → "Nouveau ? Rejoindre avec une clé d'accès"; "Login with passkey" → "Se connecter avec une clé d'accès"; "Pull to refresh" → "Tirer pour actualiser".
- [ ] **Step 3: Run** the frontend `test`, `typecheck` and `lint`, expected green. The existing specs keep passing in English. A missed key throws through the strict handler, and a dead key fails keys-manager.
- [ ] **Step 4: Commit** — `git commit -m "feat(i18n): translate entry, group, balance and repayment screens"`

---

### Task 5: Translate templates — payment and admin screens

**Files:** `payment/**` (form steps, details, delete sheet; `SPLIT_LABELS` already moved in Task 3), `admin/**` (overview, user, group: `'Single use'`, `'Multi use'`, `'Used by …'`, `'Expired …'`, `'Revoked …'`, `'Joined …'`, `'Signed in …'`), `options-step.ts` total (`'{entered} of {target} %'`). Update the JSON files.

**Interfaces:** same as Task 4; keys `payment.*`, `admin.*`.

- [ ] **Step 1:** Same treatment as Task 4. Split names: Equally / By shares / By percentage / Exact amounts → Équitable / Par parts / En pourcentage / Montants exacts. "Amount" → "Montant".
- [ ] **Step 2: Run** the frontend `test`, `typecheck` and `lint`, expected green. Then `grep -rnE ">[^<{]*[A-Za-z]{3,}[^<{]*<" apps/frontend/src/app --include='*.html'`: expect no hits other than `{{ }}` and `t(` expressions.
- [ ] **Step 3: Commit** — `git commit -m "feat(i18n): translate payment and admin screens"`

---

### Task 6: Playwright — pinned locale, two scenarios, French screenshots

**Files:**
- Modify: `apps/e2e/playwright.config.ts`, `apps/e2e/playwright.screenshots.config.ts` (`locale: 'en-US'` in `use`)
- Create: `apps/e2e/e2e/switch-the-app-to-french.spec.ts`, `apps/e2e/e2e/a-french-device-opens-in-french.spec.ts`
- Modify: `apps/e2e/screenshots/capture.spec.ts`, `matrix.ts`

- [ ] **Step 1: Scenario "switch the app to French"** (fixtures as in `change-my-name.spec.ts`): join with a new passkey, click the `Settings` link, click the `Français` radio/button, and expect the heading `Réglages`. Then `page.reload()` and expect `Réglages` again. Back on home, expect the French title of an existing element (for example the `Réglages` link's aria-label).
- [ ] **Step 2: Scenario "a French device opens in French"**: open `browser.newContext({ locale: 'fr-FR' })` on an invite link from `seedGroupWithInvite('Lisbon trip')`, and expect the French accept-invite copy ("Nouveau ? Rejoindre avec une clé d'accès") and `document.documentElement.lang === 'fr'`. This covers Review Focus 2.
- [ ] **Step 3: Run** `pnpm --filter @ardoise/e2e test:e2e`, expected all green, existing scenarios included.
- [ ] **Step 4: Screenshot language dimension.** Add `LANGUAGES = ['en', 'fr']` to the loop. `fr` only runs with `light`. Seed `ardoise.language` through the same `addInitScript` as the theme. The file name gets `-fr` for French. For `ready` checks, add a helper `say(text: string, lang)` that maps an English string to French by exact value lookup in `apps/frontend/src/i18n/en.json` → the same key in `fr.json`, and throws if there is no match. `visible()` and the click helpers call it. A cell whose ready text is a regex or dynamic switches to a role-based wait (`getByRole('heading')`, `status`) that holds in both languages.
- [ ] **Step 5: Run** `pnpm dev:front` and `pnpm --filter @ardoise/e2e screenshots`, expected green. Review every `*-fr-*` PNG for truncation or bad wrapping. Fix by shortening the French copy first.
- [ ] **Step 6: Commit** — `git commit -m "test(e2e): French scenarios and French screenshots"`

---

### Task 7: Docs and ship

- [ ] **Step 1:** `docs/roadmap.md`: tick "app in English and French", link the spec, and rename the section to "Translation (done)". `docs/design.md` decisions log gets a dated row for the language picker (native names, System translated) and for decimal separators per language. `docs/testing.md`: one line on the parity, keys-manager and strict-handler layers.
- [ ] **Step 2:** `pnpm verify`, expected green.
- [ ] **Step 3:** Commit `docs: translation slice done`, push `translation`, and open the PR with the screenshots (en light/dark, fr light). Call out that there is no new `shared/ui` building block.

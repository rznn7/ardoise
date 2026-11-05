# 11 Small Stuff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the small repeated snippets and the noise, and add a copy-paste detector as the last net.

**Architecture:** Each helper sits in `shared/` because it is plumbing with no feature knowledge: toggle-group values, guarded web storage, translated toasts. Lint keeps the raw form out once the helper exists. `jscpd` comes last, once the other plans have removed the known duplicates, so its threshold starts from a clean measurement.

`back.ts` reading the private `ɵrouterPageId` stays: it is isolated in one function and `back.spec.ts` will fail if a router upgrade renames it.

**Tech Stack:** Angular 22, ESLint built-ins (`no-restricted-globals`, `no-restricted-syntax`), `jscpd` 5.

**Spec:** `README.md` finding 11

## Global Constraints

- Storage keys unchanged (`ardoise.language`, `ardoise.lastGroup`, `ardoise.variant.*`, the theme key, `ardoise.chunk-reload`), and storage failures still fall back silently.
- Every toast today passes an already-translated key: the new `ToastService` signature takes the key.

## Review Focus

1. Private browsing where `localStorage` throws: language, theme and last group fall back to defaults without an error. Pinned in Task 2.
2. A toast with parameters (group created with its name): the parameter still interpolates. Pinned in Task 3.
3. Removing `OnPush` declarations changes nothing (it is the Angular 22 default): full test suite and Playwright.

---

### Task 1: `singleValue` for toggle groups

**Files:**
- Create: `apps/frontend/src/app/shared/single-value.ts`, `single-value.spec.ts`
- Modify: `group-page.ts` (`selectTab`), `settings.ts` (`selectTheme`, `selectLanguage`), `options-step.ts` (`selectSplit`), `admin-overview.ts`

**Interfaces:**
- Produces: `singleValue<T>(value: T | readonly T[] | null | undefined): T | undefined`

- [ ] **Step 1: Spec**: `'a'` → `'a'`; `['b']` → `'b'`; `[]`, `null`, `undefined` → `undefined`. Run, fail, implement, pass.
- [ ] **Step 2: Replace the five `typeof value === 'string' ? value : value?.[0]`; run tests and typecheck; commit**

```bash
git commit -m "singleValue reads toggle group values"
```

### Task 2: Guarded web storage

**Files:**
- Create: `apps/frontend/src/app/shared/storage.ts`, `storage.spec.ts`
- Modify: `shared/i18n/language.service.ts`, `expense-group/last-group.service.ts`, `shared/variants/variant.service.ts`, `shared/theme/theme.service.ts`, `shared/version/version-watcher.ts`, `apps/frontend/eslint.config.js`, `apps/frontend/CLAUDE.md`

**Interfaces:**
- Produces: `readStored(key: string, area: 'local' | 'session' = 'local'): string | null` and `writeStored(key: string, value: string, area: 'local' | 'session' = 'local'): void`, both swallowing storage exceptions.

- [ ] **Step 1: Spec**: round trip; `readStored` returns `null` and `writeStored` does not throw when `Storage.prototype.getItem` / `setItem` throw (`vi.spyOn`).
- [ ] **Step 2: Run, fail, implement, pass; replace the five try/catch pairs**
- [ ] **Step 3: Lint**: `'no-restricted-globals': ['error', { name: 'localStorage', message: 'Use src/app/shared/storage.ts.' }, { name: 'sessionStorage', message: 'Use src/app/shared/storage.ts.' }]` for `src/app/**/*.ts`, ignoring `src/app/shared/storage.ts` and specs.
- [ ] **Step 4: Append to `apps/frontend/CLAUDE.md` under `## Reuse`**: `- Toggle group values: \`singleValue\`; web storage: \`shared/storage.ts\`; toasts take a translation key.`
- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck`

```bash
git commit -m "Web storage behind one guarded helper"
```

### Task 3: Toasts take a translation key

**Files:**
- Modify: `apps/frontend/src/app/shared/toast.service.ts` (+ spec), every caller (`feed-store.ts`, `group-page.ts`, `payment-details.ts`, `settlement-details.ts`, `admin-user.ts`, `admin-group.ts`, `create-group-sheet.ts`, any other `toast.` caller)

**Interfaces:**
- Produces: `ToastService.error(key: TranslationKey, params?: HashMap): void` and `message(key: TranslationKey, params?: HashMap): void`, translating with `LanguageService.translator()`.

- [ ] **Step 1: Spec** `translates the key with its params` (spy on `toast` from `@spartan-ng/brain/sonner`). Run, fail, implement, pass.
- [ ] **Step 2: Callers pass `marker('…')` directly; delete `FeedStore.translate` and any `LanguageService` injection left unused; run tests and typecheck; commit**

```bash
git commit -m "Toasts take a translation key"
```

### Task 4: Noise

**Files:**
- Modify: the 15 files declaring `changeDetection` (find them with `grep -rln OnPush apps/frontend/src/app`)
- Modify: `apps/frontend/src/app/shared/ui/load-more/load-more.ts`
- Modify: `apps/frontend/src/app/expense-group/expense-group-api.service.ts` and its callers
- Modify: `apps/frontend/eslint.config.js`

- [ ] **Step 1: Delete every `changeDetection: ChangeDetectionStrategy.OnPush` and its import**; add `{ selector: "Property[key.name='changeDetection']", message: 'Components are OnPush by default in Angular 22.' }` to the `src/app/**/*.ts` selectors.
- [ ] **Step 2: `LoadMore`** keeps its observer inside `effect((onCleanup) => …)` and drops the outer `let observer` and the `DestroyRef` hook (shared building block: an effect that syncs to `IntersectionObserver` is the legitimate kind).
- [ ] **Step 3: `ExpenseGroupApiService`** wraps like its siblings: `listMine()`, `findOne(id: number)`, `create(body: CreateExpenseGroupBody)`. Callers stop passing `{ params: { id } }`.
- [ ] **Step 4: Verify and commit**

Run: `pnpm verify`

```bash
git commit -m "Drop redundant OnPush and align the group API service"
```

### Task 5: Copy-paste detector (last task of the series)

**Files:**
- Create: `apps/frontend/.jscpd.json`
- Modify: `apps/frontend/package.json` (devDependency `jscpd@^5.4.2`; `lint` runs `jscpd` last)

- [ ] **Step 1: Configure**

```json
{
  "path": ["src/app"],
  "ignore": ["**/*.spec.ts", "**/*.testing.ts"],
  "format": ["typescript", "markup"],
  "minTokens": 50,
  "reporters": ["consoleFull"],
  "gitignore": true
}
```

- [ ] **Step 2: Measure**

Run: `pnpm --filter @ardoise/frontend exec jscpd`
Expected: a clone list and a total duplication percentage.

- [ ] **Step 3: Triage each clone**: a real duplicate that one of plans 01 to 10 missed gets fixed in this task; a legitimate similarity (two templates sharing markup by design) stays. Then set `"threshold"` to the measured percentage rounded up to the next whole number, so new copy-paste fails `lint`.
- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint`

```bash
git commit -m "jscpd fails lint on new copy-paste"
```

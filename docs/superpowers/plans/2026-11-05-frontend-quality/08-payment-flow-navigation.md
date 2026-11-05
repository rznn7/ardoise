# 08 Payment Flow Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The payment flow moves through history by measured page ids instead of assumed counts, and app URLs are built in one place.

**Architecture:** Today `OptionsStep` assumes the history is exactly group → amount → title → options (`historyGo(-2)`, `historyGo(-3)`, `historyGo(-1)`). Instead, each step records the router page id it was activated on, the draft remembers it, and leaving or jumping to a step computes the distance from those measurements. The page-id mechanics already live in `shared/navigation/back.ts` (the only place touching the private `ɵrouterPageId`); this plan adds a "jump to page id" there and keeps `historyGo` nowhere else. URL builders go to `shared/navigation/urls.ts` because they cross contexts (home, group, payment, settlement).

**Tech Stack:** Angular 22 router (`canceledNavigationResolution: 'computed'` via `withHistoryPageIds`), `provideLocationMocks` for specs, Playwright.

**Spec:** `README.md` finding 08

## Global Constraints

- User-visible behaviour unchanged: after saving a new payment, Back from the group page does not re-enter the form; after saving an edit, the details page is on top.
- Deep link (`enteredDirectly`): leaving uses `navigateByUrl(url, { replaceUrl: true })`, as today.
- A page id is read at the `NavigationEnd` that activated the step, when the browser state is committed.

## Review Focus

1. Title → browser Back → amount → Next → title → Next → options → Save: lands on the group page with nothing of the form behind it. Pinned in Task 2.
2. Edit: options → amount → Done → Save: lands on the details page. Pinned in Task 2.
3. Deep link to the amount step, then Save: group page replaces the form. Pinned in Task 2.
4. Options → tap the amount (new flow) → change → Next → title → Next: the draft is kept (no guard reset). Covered by the existing Playwright amount scenario; check it still passes.

---

### Task 1: URL builders

**Files:**
- Create: `apps/frontend/src/app/shared/navigation/urls.ts`
- Modify: `home/home/home.ts`, `settlement/settlement-details/settlement-details.ts`, `payment/payment-details/payment-details.ts`, `expense-group/group-page/group-visit.ts`, `payment/payment-form/amount-step.ts`, `title-step.ts`, `options-step.ts`, `payment-flow.guard.ts`, `apps/frontend/eslint.config.js`

**Interfaces:**
- Produces:

```ts
export type PaymentStep = 'amount' | 'title' | 'options';
export const groupUrl: (groupId: number) => string;                                   // '/group/1'
export const paymentUrl: (groupId: number, paymentId: number) => string;              // '/group/1/payments/5'
export const settlementUrl: (groupId: number, settlementId: number) => string;
export const paymentStepUrl: (groupId: number, paymentId: number | null, step: PaymentStep) => string;
// null → '/group/1/payments/new/amount', 5 → '/group/1/payments/5/edit/amount'
```

- [ ] **Step 1: Implement; replace every `` `/group/${...}` `` literal and every `['/group', ...]` command array; delete the steps' `newUrl`, `editUrl`, `optionsUrl`**
- [ ] **Step 2: Lint guard**, added to the `src/app/**/*.ts` block's `no-restricted-syntax` array, with `src/app/shared/navigation/urls.ts` ignored for these selectors (give `urls.ts` its own block repeating the other selectors):

```js
{ selector: 'TemplateElement[value.raw=/^.group.$/]', message: 'Build app URLs with src/app/shared/navigation/urls.ts.' },
{ selector: "ArrayExpression > Literal[value='/group']", message: 'Build app URLs with src/app/shared/navigation/urls.ts.' },
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test`

```bash
git commit -m "App URLs built in one place"
```

### Task 2: Measured history moves

**Files:**
- Modify: `apps/frontend/src/app/shared/navigation/back.ts` (+ spec if absent)
- Modify: `apps/frontend/src/app/payment/payment-draft.ts`, `payment-draft.spec.ts`
- Modify: `apps/frontend/src/app/payment/payment-form/amount-step.ts`, `title-step.ts`, `options-step.ts`, `options-step.spec.ts`
- Modify: `apps/frontend/eslint.config.js`, `apps/frontend/CLAUDE.md`

**Interfaces:**
- Consumes: `PaymentDraft` from plan 07, `PaymentStep` from Task 1.
- Produces:

```ts
// back.ts
export function injectHistoryJump(): (pageId: number) => void;      // historyGo(pageId - current); no-op when equal
export function injectStepPageId(): Signal<number | null>;          // page id at the NavigationEnd that activated the caller

// PaymentDraft
markStepPage(step: PaymentStep, pageId: number): void;
stepPageId(step: PaymentStep): number | null;
originPageId: Signal<number | null>;   // entry step's page id - 1; null when enteredDirectly
```

The entry step is `amount` for a new payment and `options` for an edit.

- [ ] **Step 1: Failing tests in `options-step.spec.ts`**, with the real router, `provideLocationMocks()` and the payment form routes, asserting `Location.path()`:

- `returns to the group after saving a new payment`: `/group/1` → amount → title → options → Save → path `/group/1`.
- `returns to the group after stepping back and forward`: amount → title → `location.back()` → amount → Next → title → Next → options → Save → `/group/1`.
- `returns to the payment after an edit that visited the amount`: `/group/1/payments/5` → options → amount → Done → Save → `/group/1/payments/5`.
- `replaces with the group page when entered directly`: initial navigation to the amount step → … → Save → `/group/1` and `replaceUrl` used.

- [ ] **Step 2: Run, see them fail (today's fixed counts or the mocks' history disagree)**

Run: `pnpm --filter @ardoise/frontend test -- options-step`

- [ ] **Step 3: Implement**

Each step calls `injectStepPageId()` and marks its page in the draft when the signal becomes non-null. `OptionsStep.openAmount` / `openTitle` in new mode jump to `stepPageId('amount' | 'title')`. `leave(url)` jumps to `originPageId()` when it is not null, else `navigateByUrl(url, { replaceUrl: true })`.

- [ ] **Step 4: Lint guard**: `CallExpression[callee.property.name='historyGo']` with message `'Move through history with src/app/shared/navigation/back.ts helpers.'`, all of `src/app` except `back.ts`.

- [ ] **Step 5: Append to `apps/frontend/CLAUDE.md` under `## Copy and navigation`**

```markdown
- URLs come from `src/app/shared/navigation/urls.ts`; history jumps from `back.ts` (lint enforces both).
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/e2e test:e2e`

```bash
git commit -m "Payment flow leaves by measured history page ids"
```

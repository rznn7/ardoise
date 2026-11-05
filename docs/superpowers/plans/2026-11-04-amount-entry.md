# Amount Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The payment total fills like a cash register: digits enter from the right, no separator is typed.

**Architecture:** One pure function turns whatever text the field holds after an edit into the
cash-register text (digits read as cents, reformatted). It lives in `money-input.ts` next to the
other amount parsing, because it is a rule about money text with no Angular or DOM in it: the
frontend equivalent of `domain/`. The amount step only wires the input event to it, writes the
result back into the field and keeps the caret at the end. The draft keeps `amountText`, so
`parseAmount`, the edit prefill and the options step are untouched.

**Tech Stack:** Angular 22 signals, vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-amount-entry-design.md`

## Global Constraints

- Only the payment total changes; per-person exact amounts and percentages keep free entry and `inputmode="decimal"`.
- Separator follows the active language via `formatAmountInput`; no thousands grouping.
- Upper bound `MAX_CENTS` = 2 147 483 647: an edit that would exceed it is refused (field keeps its previous text).
- No comments in code (owner's rule). Commit messages are one line.

## Review Focus

1. Typing `0` on an empty field: the DOM must show empty, even though `amountText` stays `''` and Angular's `[value]` binding sees no change. Pinned in Task 2.
2. A digit typed after the caret was moved to the middle: the caret is put back at the end after every edit and on focus, so the next digit appends. Pinned in Task 2 (caret at end after typing).
3. Hardware keyboard `,` or `.` or a letter: the digits are unchanged, the field rewrites to the same text. Pinned in Task 1 (`'1,23,'` and `'1,23a'`).
4. Editing an existing payment: the field opens on `12.50` and `3` gives `125.03`. Pinned in Task 2.
5. Pasting `24,5` gives `2,45` (accepted in the spec). Pinned in Task 1.

---

### Task 1: `cashRegisterText` pure rule

**Files:**
- Modify: `apps/frontend/src/app/payment/money-input.ts`
- Test: `apps/frontend/src/app/payment/money-input.spec.ts`

**Interfaces:**
- Produces: `cashRegisterText(typed: string, previous: string, locale: string): string`. Returns `''` when the digits of `typed` are none or all zeros; `previous` when they exceed `MAX_CENTS`; otherwise `formatAmountInput(cents, locale)` of the digits read as cents.

- [ ] **Step 1: Write the failing tests** in a `describe('cashRegisterText')` block, locale `'en'` unless noted:

```ts
it.each([
  ['1', '', '0.01'],
  ['0.012', '0.01', '0.12'],
  ['0.123', '0.12', '1.23'],
  ['1.230', '1.23', '12.30'],
  ['1.2', '1.23', '0.12'],
  ['0.0', '0.01', ''],
  ['0', '', ''],
  ['abc', '', ''],
  ['', '0.01', ''],
  ['1.23,', '1.23', '1.23'],
  ['1.23a', '1.23', '1.23'],
  ['24,50', '', '24.50'],
  ['24,5', '', '2.45'],
  ['12.503', '12.50', '125.03'],
])('turns %j (was %j) into %j', (typed, previous, expected) => {
  expect(cashRegisterText(typed, previous, 'en')).toBe(expected);
});

it('writes a French comma', () => {
  expect(cashRegisterText('0,123', '0,12', 'fr')).toBe('1,23');
});

it('accepts the largest amount and refuses one digit more', () => {
  expect(cashRegisterText('2147483647', '', 'en')).toBe('21474836.47');
  expect(cashRegisterText('21474836.479', '21474836.47', 'en')).toBe('21474836.47');
});
```

- [ ] **Step 2: Run** `pnpm --filter @ardoise/frontend exec vitest run src/app/payment/money-input.spec.ts`. Expected: FAIL, `cashRegisterText` not exported.

- [ ] **Step 3: Implement `cashRegisterText`** in `money-input.ts`: strip non-digits, strip leading zeros, compare with `MAX_CENTS` before converting (a long digit string must not lose precision: compare by length first, then `Number`), format with `formatAmountInput`.

- [ ] **Step 4: Run** the same command. Expected: PASS.

- [ ] **Step 5: Commit** `git commit -m "Cash-register rule for amount text"`

### Task 2: Amount step uses cash-register entry

**Files:**
- Modify: `apps/frontend/src/app/payment/payment-form/amount-step.ts`, `amount-step.html`
- Test: `apps/frontend/src/app/payment/payment-form/amount-step.spec.ts`

**Interfaces:**
- Consumes: `cashRegisterText` (Task 1); `LanguageService.translator().locale` (`src/app/shared/i18n/language.service`).

- [ ] **Step 1: Update the spec** (English locale, so `.` separator):
  - `focuses a decimal amount field…` → asserts `inputmode` is `'numeric'` (rename to "focuses a numeric amount field…").
  - `it.each(['', '0', 'abc'])('keeps Next disabled…')` stays; add `expect(amountInput().value).toBe('')` for each.
  - Replace `enables Next for a comma decimal` with `fills digits from the right`: type `123` → `amountInput().value === '1.23'`, `draft.amountCents() === 123`, Next enabled, and `amountInput().selectionStart === 4`.
  - Add `empties on backspace and disables Next`: type `12{Backspace}{Backspace}` → value `''`, Next disabled.
  - Add `continues from the right in edit mode`: before typing, `draft.mode.set('edit')`, `draft.amountText.set('12.50')`, `TestBed.tick()`; type `3` → value `'125.03'`, `draft.amountCents() === 12503`.
  - `24,5` in the Next and Enter tests → `2450`.

- [ ] **Step 2: Run** `pnpm --filter @ardoise/frontend exec vitest run src/app/payment/payment-form/amount-step.spec.ts`. Expected: the new and changed tests FAIL.

- [ ] **Step 3: Implement.** In the template: `inputmode="numeric"`, `(input)="typeAmount()"`, `(focus)="caretToEnd()"`, `(click)="caretToEnd()"`. In the component: `typeAmount()` computes `cashRegisterText(input.value, draft.amountText(), locale)`, sets `draft.amountText`, assigns the same text to `input.value` (the binding alone misses unchanged values) and calls `caretToEnd()`; `caretToEnd()` sets the selection to `[value.length, value.length]`.

- [ ] **Step 4: Run** the same command. Expected: PASS. Then `pnpm --filter @ardoise/frontend test` and `pnpm typecheck`: green.

- [ ] **Step 5: Commit** `git commit -m "Amount step fills digits from the right"`

### Task 3: Playwright callers, docs, verify

**Files:**
- Modify: `apps/e2e/e2e/*.spec.ts` callers of `addPayment`/`startPayment`, `docs/roadmap.md`, `docs/design.md`

- [ ] **Step 1: Two-decimal amounts in Playwright.** Every `addPayment(…, 'N', …)` / `startPayment(…, 'N', …)` with a whole amount gets `'N,00'` (`'30'` → `'30,00'`, `'12'`, `'18'`, `'24'`, `'10'` likewise). `'3,20'` and `fill('24,50')` stay. Check: `grep -rnE "(addPayment|startPayment)\([^,]+, '[0-9]+'" apps/e2e/e2e` prints nothing.

- [ ] **Step 2: Docs.** In `docs/roadmap.md`, replace the Amount entry bullet with a checked `cash-register entry` bullet (total only, spec path) and an open bullet for inline math and a validate key on the keyboard. In `docs/design.md`'s A/B decisions log, add a row: `2026-11-04 | Payment amount | Cash-register entry for the total, no fork | The owner picked it outright: only digits under the thumb on the iOS pad; per-person amounts keep free entry`.

- [ ] **Step 3: Verify.** `pnpm verify`. Expected: lint, typecheck, unit, e2e, build all green.

- [ ] **Step 4: Screenshots.** With `pnpm dev:front` running, `pnpm --filter @ardoise/e2e screenshots` and check the amount step empty and typed (`24.50`), light and dark.

- [ ] **Step 5: Commit** `git commit -m "Playwright amounts and docs for cash-register entry"`

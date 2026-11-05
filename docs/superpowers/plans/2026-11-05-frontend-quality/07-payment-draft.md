# 07 Payment Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `PaymentDraft` owns its state: one state signal, read-only views, intent methods, initialisation in one call, and no request built from an invalid draft.

**Architecture:** The draft is the payment form's application state, shared by three routed steps and the guard. Encapsulating it means the steps and guard express intents (`toggleIncluded`, `setWeight`) and the draft decides how state changes, the same split as a backend use case calling an aggregate. A single `signal<DraftState | null>` makes "inactive" a value (`null`) instead of a separate flag plus sentinels (`groupId = 0`), and makes `clear()` one assignment that cannot forget a field.

**Tech Stack:** Angular 22 signals, vitest, ESLint `no-restricted-syntax`.

**Spec:** `README.md` finding 07

## Global Constraints

- Public read names stay as today (`amountText`, `title`, `splitType`, `included`, `weights`, `percentTexts`, `exactTexts`, `amountCents`, `preview`, `runningTotal`, `valid`, `mode`, `group`, `paymentId`, `members`, `myMemberId`, `enteredDirectly`, `date`, `payerMemberId`), now read-only signals, so templates change only where they write.
- `groupId` becomes `Signal<number | null>` (null when inactive) and is derived from `group`.
- `paidAt` rules unchanged: keep the stored `paidAt` when editing and the date is untouched; today's date → now; other dates → noon local.

## Review Focus

1. Saving with no payer or an invalid amount (reachable only through a bug): nothing is sent. Pinned in Task 1 (`toRequest` returns `null`).
2. Starting a new payment after abandoning one: no leftover title, weights or percentages. Pinned in Task 1.
3. Editing a payment whose payer left the members list: the draft keeps that payer id. Existing edit tests; check they still pass.
4. The options step showing a title before the user typed one: the dated default, without building a request. Pinned in Task 1 (`effectiveTitle`).

---

### Task 1: Encapsulated draft

**Files:**
- Modify: `apps/frontend/src/app/payment/payment-draft.ts`, `payment-draft.spec.ts`
- Modify: `apps/frontend/src/app/payment/payment-form/payment-flow.guard.ts`, `payment-flow.guard.spec.ts`
- Modify: `apps/frontend/src/app/payment/payment-form/amount-step.ts`, `title-step.ts`, `title-step.html`, `options-step.ts`, `options-step.html`, their specs
- Modify: `apps/frontend/src/app/payment/payment-details/payment-details.ts` (calls `clear()` only)

**Interfaces:**
- Consumes: `GroupContext` from plan 02 (the guard passes `group`, `members`, `myMember`).
- Produces:

```ts
interface NewDraft {
  readonly group: ExpenseGroupSummary;
  readonly members: readonly GroupMember[];
  readonly myMemberId: number;
  readonly enteredDirectly: boolean;
}
interface EditDraft {
  readonly group: ExpenseGroupSummary;
  readonly payment: PaymentResponse;
  readonly shares: readonly PaymentShareResponse[];
  readonly members: readonly GroupMember[];
  readonly myMemberId: number | null;
  readonly enteredDirectly: boolean;
}

class PaymentDraft {
  readonly active: Signal<boolean>;
  readonly groupId: Signal<number | null>;
  readonly effectiveTitle: Signal<string>;     // typed title, or the dated default
  startNew(draft: NewDraft): void;
  startEdit(draft: EditDraft): void;
  clear(): void;
  setAmountText(text: string): void;
  setTitle(text: string): void;
  setPayer(memberId: number): void;
  setDate(text: string): void;
  setSplitType(type: SplitType): void;
  toggleIncluded(memberId: number): void;
  setWeight(memberId: number, weight: number): void;
  setPercentText(memberId: number, text: string): void;
  setExactText(memberId: number, text: string): void;
  toRequest(): UpdatePaymentBody | null;       // null when !valid()
}
```

- [ ] **Step 1: Failing tests in `payment-draft.spec.ts`**

- `starts a new payment in one call`: `startNew({ group, members, myMemberId: 2, enteredDirectly: true })` → `groupId() === group.id`, `payerMemberId() === 2`, every member included, `date()` is today, `enteredDirectly()` true.
- `forgets everything on clear`: set title, weights, percent texts; `clear()` → `active()` false; `startNew(...)` → title `''`, weights all 1, percent texts empty.
- `builds no request when the draft is invalid`: amount `''` → `toRequest()` is `null`; valid amount but `included` empty → `null`.
- `uses the dated default as the effective title`: title `''`, today 2026-11-05 → `effectiveTitle()` equals `defaultTitle(...)` for that date; title `'Pizza'` → `'Pizza'`.
- `toggles a member out and back in`.

- [ ] **Step 2: Run, see them fail**

Run: `pnpm --filter @ardoise/frontend test -- payment-draft`

- [ ] **Step 3: Implement the draft, then move every caller to the intents**

Guard: `startNew` / `startEdit` with everything; no `.set` after. Steps: `draft.amountText.set` → `setAmountText`, `draft.date.set` → `setDate`, `draft.included.update` → `toggleIncluded`, and so on. `OptionsStep.displayTitle` → `draft.effectiveTitle()`. `OptionsStep.save` returns when `toRequest()` is `null`. Delete `started`, `reset`, `storedPaidAt`, `storedDate` fields (they live in `DraftState`).

- [ ] **Step 4: Lint guard**

In the `eslint.config.js` block from plan 04 (stores and services), add `src/app/**/*-draft.ts` to `files` and this selector:

```js
{
  selector: "PropertyDefinition[value.callee.name='signal']:not([accessibility='private']):not([accessibility='protected'])",
  message: 'Expose a read-only signal and intent methods; keep the writable signal private.',
}
```

Prove it fires by making one field public temporarily, as in plan 04.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/e2e test:e2e`

```bash
git commit -m "Payment draft owns its state behind intent methods"
```

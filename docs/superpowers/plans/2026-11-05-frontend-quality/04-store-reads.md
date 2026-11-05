# 04 Store Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stores expose plain reads; components wrap them in one `computed`, and the signal-of-signal layer disappears.

**Architecture:** A store's state is already made of signals, so a plain method that reads them is reactive wherever it is called inside a `computed` or a template. Returning a fresh `computed` per call buys nothing and forces callers to hold a signal of a signal (`computed(() => this.feedOfGroup()())`). This is an API change of the application layer (stores); the component layer becomes a direct read.

**Tech Stack:** Angular 22 signals, vitest, ESLint `no-restricted-syntax`.

**Spec:** `README.md` finding 04

## Global Constraints

- Naming: a parameterised read is `somethingOf(id)` or `isSomething(id)`, returns a value, never a `Signal`.
- Behaviour unchanged; this is a rename plus removal of the intermediate `computed`s.

## Review Focus

1. A read called outside a reactive context (in an event handler) must still return the current value: plain reads do, nothing to pin.
2. `GroupPage` switching group id while mounted: each read follows the new id because `this.groupId()` is read inside the same `computed`. Covered by the existing group-switch test in `group-page.spec.ts`; if absent, add `follows the new group when the id changes`.

---

### Task 1: Plain reads in the three stores and their callers

**Files:**
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`
- Modify: `apps/frontend/src/app/settlement/done-store.ts` and its spec
- Modify: `apps/frontend/src/app/balance/balance-store.ts` and its spec
- Modify: `apps/frontend/src/app/shared/variants/variant.service.ts` and its callers
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `apps/frontend/src/app/payment/payment-details/payment-details.ts`

**Interfaces:**
- Produces (old → new):

| Store | Old | New |
|---|---|---|
| `FeedStore` | `feed(groupId): Signal<FeedState>` | `feedOf(groupId): FeedState` (the private `feedOf` becomes public) |
| | `pendingSettlements(groupId)` | `pendingSettlementsOf(groupId): readonly CreateSettlementBody[]` |
| | `settledVersion(groupId)` | `settledVersionOf(groupId): number` |
| | `pendingUpdate(id)` | `pendingUpdateOf(id): UpdatePaymentBody \| null` |
| | `refreshState(groupId)` | `refreshStateOf(groupId): 'idle' \| 'loading' \| 'error'` |
| `DoneStore` | `done(groupId)` | `doneOf(groupId): DoneState` |
| | `refreshState(groupId)` | `refreshStateOf(groupId)` |
| `BalanceStore` | `balances(groupId)` | `balancesOf(groupId): BalancesState` |
| | `refreshing(groupId)` | `isRefreshing(groupId): boolean` |
| `VariantService` | `variant(key)` | `variantOf(key): Variant` |

- [ ] **Step 1: Rename in the stores and their specs**

In specs, `store.feed(1)()` becomes `store.feedOf(1)`. Where a spec relied on the returned signal to observe later changes, read again after the change.

- [ ] **Step 2: Collapse the callers**

In `GroupPage`, each pair `xOfGroup` + `x` becomes one `computed(() => this.store.xOf(this.groupId()))`; `untracked(this.settledOfGroup)()` becomes `untracked(() => this.feedStore.settledVersionOf(groupId))`. Same in `PaymentDetails` for `pendingUpdate`.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck && grep -rn "()());" apps/frontend/src/app`
Expected: green, and the grep prints nothing.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app
git commit -m "Stores expose plain reads instead of signal factories"
```

### Task 2: Lint guard

**Files:**
- Modify: `apps/frontend/eslint.config.js`

- [ ] **Step 1: Add a block for `src/app/**/*-store.ts` and `src/app/**/*.service.ts`**

Carry over the selectors from the `src/app/**/*.ts` block (ESLint keeps one options array per rule per file) and add:

```js
{
  selector: "MethodDefinition[value.params.length>0] > FunctionExpression > TSTypeAnnotation > TSTypeReference[typeName.name='Signal']",
  message: 'Stores and services expose plain reads; let the caller wrap them in computed().',
},
{
  selector: "MethodDefinition[value.params.length>0] ReturnStatement > CallExpression[callee.name='computed']",
  message: 'Stores and services expose plain reads; let the caller wrap them in computed().',
},
```

- [ ] **Step 2: Prove the selectors fire**

Temporarily add `x(id: number): Signal<number> { return computed(() => id); }` to `BalanceStore`, run `pnpm --filter @ardoise/frontend exec eslint src/app/balance/balance-store.ts`, expect both messages, then remove it. If esquery rejects `length>0`, use `:not([value.params.length=0])` instead.

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint`

```bash
git add apps/frontend/eslint.config.js
git commit -m "Lint rejects parameterised signal factories in stores"
```

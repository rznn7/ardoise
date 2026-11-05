# 05 Store Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a mutation settles, the store that performed it tells whoever must react; no component watches a counter with an `effect` to guess that it happened.

**Architecture:** Two edge-detecting effects go away. `GroupPage`'s `lastSettled` effect reloads balances after the feed changes: `FeedStore` asks `BalanceStore` directly, because "balances follow payments" is a rule of the application layer, true whichever screen is open. `PaymentDetails`' `hadPendingUpdate` effect waits for its own edit to land: `FeedStore` publishes saved updates as an event stream and the page applies and reloads on that event. The duplicated "apply an update body to a payment" becomes one pure function in the payment context (domain-like: no Angular).

**Tech Stack:** Angular 22 signals, RxJS 7 `Subject`, vitest.

**Spec:** `README.md` finding 05

## Global Constraints

- `BALANCE_COALESCE_MS` (300) still coalesces balance reloads.
- `BalanceStore` only reloads groups it has already loaded.
- No new dependency from `BalanceStore` to `FeedStore` (the arrow goes Feed → Balance).

## Review Focus

1. Saving a payment while the group page is closed (from the details page): returning shows fresh balances without the visit's `settledVersion` check. Pinned in Task 1.
2. Editing a payment and watching its details: the new values stay on screen from the moment the save succeeds, no flash of the old values before the reload answers. Pinned in Task 2.
3. A failed edit: details fall back to the server values and the toast shows, as today (existing spec).
4. The realtime echo of my own update arriving before the HTTP response: values stay correct, at most one extra reload. Pinned in Task 2.

---

### Task 1: FeedStore reloads balances itself

**Files:**
- Modify: `apps/frontend/src/app/balance/balance-store.ts` and spec
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `group-visit.ts`, `group-page.spec.ts`

**Interfaces:**
- Produces: `BalanceStore.reloadSoon(groupId: number): void` (today's private `loadSoon`, renamed and public). `GroupVisit` becomes `{ scrollTop: number }`.

- [ ] **Step 1: Write the failing test in `feed-store.spec.ts`**

`reloads balances of a loaded group once a payment is saved`: with the real `BalanceStore` and a fake `BalanceApiService`, `balances.load(1)`, then `create(...)` succeeds, advance 300 ms → `listByGroup(1)` called a second time.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @ardoise/frontend test -- feed-store`

- [ ] **Step 3: Implement**

`FeedStore.markSettled(groupId)` calls `this.balances.reloadSoon(groupId)`. Delete the `lastSettled` effect in `GroupPage`, the `settledVersion` comparison in `resume()`, and `settledVersion` from `GroupVisit`. If `settledVersionOf` has no caller left, make it private.

- [ ] **Step 4: Run feed-store, balance-store and group-page specs, typecheck, commit**

Run: `pnpm --filter @ardoise/frontend test -- feed-store balance-store group-page && pnpm --filter @ardoise/frontend typecheck`

```bash
git commit -m "Feed store reloads balances after its own mutations"
```

### Task 2: Saved updates as an event

**Files:**
- Create: `apps/frontend/src/app/payment/payment-update.ts`
- Test: `apps/frontend/src/app/payment/payment-update.spec.ts`
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`
- Modify: `apps/frontend/src/app/payment/payment-details/payment-details.ts`, `payment-details.spec.ts`

**Interfaces:**
- Produces:

```ts
export const applyPaymentUpdate = (payment: PaymentResponse, body: UpdatePaymentBody): PaymentResponse;
export const sharesOfUpdate = (body: UpdatePaymentBody): readonly { memberId: number; amount: number }[] | null; // null on InvalidSplit

interface SavedPaymentUpdate { readonly paymentId: number; readonly body: UpdatePaymentBody }
FeedStore.savedUpdates: Observable<SavedPaymentUpdate>;
```

`confirmedUpdates`, `confirmedUpdate(id)` disappear from `FeedStore`.

- [ ] **Step 1: Unit spec for the pure functions**

`applyPaymentUpdate` copies `payerMemberId`, `title`, `paidAt`, `fullAmount`, `splitType` and keeps `id`, `groupId`, `createdAt`. `sharesOfUpdate` returns the shares of a valid equal split summing to `fullAmount`, and `null` for an exact split that does not sum.

- [ ] **Step 2: Failing tests**

`feed-store.spec.ts`: `publishes the update once the server accepts it` (subscribe to `savedUpdates`, `update(1, 5, body)`, answer success → one emission `{ paymentId: 5, body }`); `publishes nothing when the update fails`.
`payment-details.spec.ts`: `keeps the edited values when the save lands, then reloads`: pending update shows the new title; answer success → title still new, `findOne(5)` called again; answer the reload → title from server.

- [ ] **Step 3: Implement**

`FeedStore.withUpdate` and `PaymentDetails.withUpdate` / `sharesOf` use the new functions. `FeedStore.update` emits on `savedUpdates` in its success path. `PaymentDetails` subscribes with `takeUntilDestroyed()`, filters its `paymentId`, `details.update(...)` with `applyPaymentUpdate` and `sharesOfUpdate`, then `details.reload()`. Delete the `hadPendingUpdate` effect and `confirmedUpdate` signal.

- [ ] **Step 4: Verify and commit**

Run: `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/e2e test:e2e`

```bash
git commit -m "Payment details react to saved updates instead of watching pending state"
```

# 03 Resource Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pages load with `rxResource` instead of `effect` + `untracked` + `subscribe` + a `latestLoad` counter, and no load can act after its page is gone.

**Architecture:** One shared helper, `loadStateOf`, turns a resource into the discriminated union the templates already switch on (`loading`, `not-found`, `error`, `loaded`). It keeps the last loaded value when a reload of the same thing fails, which is today's "revalidating" behaviour. It lives in `shared/` because it is plumbing between Angular resources and templates, with no feature knowledge. Pages then declare what they load (`params` → `stream`) and let Angular cancel stale and orphaned requests.

**Tech Stack:** Angular 22 `rxResource` (`@angular/core/rxjs-interop`), `linkedSignal`, vitest.

**Spec:** `README.md` finding 03

## Global Constraints

- `resource.value()` throws in the error state: read through `hasValue()` or through `loadStateOf`.
- Not found means `isNotAccessible` (403 or 404) from plan 02.
- Revalidation (realtime, resync) of the same item keeps showing the last data when it fails for any other reason.
- No `latestLoad`-style counter remains in a component.

## Review Focus

1. Flaky network while a payment is open: a failed revalidation keeps the payment on screen. Pinned in Task 1 and Task 2.
2. The same component switching from payment 5 to payment 6: it shows loading, never payment 5's data under 6's URL. Pinned in Task 1 (`a new key starts from loading`).
3. Leaving a payment before the post-resync check answers 404: no navigation. Pinned in Task 2.
4. Home receiving a burst of realtime events: one balances reload per `BALANCE_COALESCE_MS` window, as today (existing home spec).
5. Invite link opened offline: "Couldn't load this invite" and retry, not "no longer valid". Pinned in Task 5.

---

### Task 1: `loadStateOf`

**Files:**
- Create: `apps/frontend/src/app/shared/load-state.ts`
- Test: `apps/frontend/src/app/shared/load-state.spec.ts`
- Modify: `apps/frontend/CLAUDE.md`

**Interfaces:**
- Produces:

```ts
export type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly value: T };

export function loadStateOf<T>(
  resource: ResourceRef<T | undefined>,
  key: () => unknown,
): Signal<LoadState<T>>;
```

`key` identifies what is loaded (e.g. the payment id). A failure keeps the previous `loaded` value only when `key` has not changed since it loaded and the error is not `isNotAccessible`.

- [ ] **Step 1: Write the failing spec**

Drive a real `rxResource` whose stream is a `Subject` per call, inside `TestBed.runInInjectionContext`. Cases:

- `starts loading`, then `loaded` with the emitted value.
- `reports not-found for 403 and 404`, `error for anything else` on a first load.
- `keeps the loaded value when a reload fails`: load, `reload()`, error 500 → still `loaded` with the first value.
- `reports not-found when a reload answers 404` (the item is gone).
- `a new key starts from loading`: loaded for key 5, switch key to 6 → `loading`; then error 500 → `error`, not key 5's value.

- [ ] **Step 2: Run it, see it fail, implement with `linkedSignal`, run it again**

Run: `pnpm --filter @ardoise/frontend test -- load-state`
Expected: FAIL, then PASS.

- [ ] **Step 3: Append to `apps/frontend/CLAUDE.md` under `## Signals and effects`**

```markdown
- Pages load with `rxResource` and read it through `loadStateOf` (`src/app/shared/load-state.ts`). No `latestLoad` counters in components.
```

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/app/shared/load-state* apps/frontend/CLAUDE.md
git commit -m "loadStateOf maps a resource to the page load state"
```

### Task 2: PaymentDetails loads with a resource

**Files:**
- Modify: `apps/frontend/src/app/payment/payment-details/payment-details.ts`, `.html`, `.spec.ts`

**Interfaces:**
- Consumes: `loadStateOf` (Task 1), `GroupContextStore.ensure` (plan 02), `isNotAccessible`.

- [ ] **Step 1: Add the regression test**

`does not leave when the page is gone before the resync check answers`: open payment 5, emit `resynced`, destroy the fixture, answer the pending `findOne(5)` with 404 → `Location.back` and `Router.navigateByUrl` not called, no toast.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @ardoise/frontend test -- payment-details`
Expected: the new test FAILS (navigation happens).

- [ ] **Step 3: Rewrite the loading**

`details = rxResource({ params: () => ({ groupId, paymentId }), stream: forkJoin({ payment, shares, context: ensure(groupId) }) })`; `state = loadStateOf(details, () => this.paymentId())`, then the pending-update overlay on top (unchanged until plan 05). Delete the loading `effect`, `fetched`, `latestLoad`, `load()`.

Realtime: `payment.saved` for this id → `details.update(...)` with the saved payment, then `details.reload()`. `payment.deleted` → `leaveBecauseDeleted()`. `resynced` → `paymentApi.findOne(id)` piped through `takeUntilDestroyed(this.destroyRef)`: success → `details.reload()`, `isNotAccessible` → `leaveBecauseDeleted()`, else `() => undefined`.

- [ ] **Step 4: Run the spec, typecheck, commit**

Run: `pnpm --filter @ardoise/frontend test -- payment-details && pnpm --filter @ardoise/frontend typecheck`

```bash
git add apps/frontend/src/app/payment/payment-details
git commit -m "Payment details load with a resource"
```

### Task 3: SettlementDetails loads with a resource

**Files:**
- Modify: `apps/frontend/src/app/settlement/settlement-details/settlement-details.ts`, `.html`, `.spec.ts` (create the spec if absent, with the test below and the not-found state)

Same shape as Task 2: `stream: forkJoin({ settlement, context: ensure(groupId) })`, `settlement.saved` / `settlement.deleted` / `resynced` handled the same way with `leaveBecauseUndone()`.

- [ ] **Step 1: Write the same regression test for settlements, see it fail**
- [ ] **Step 2: Rewrite, run spec and typecheck, commit**

```bash
git commit -m "Settlement details load with a resource"
```

### Task 4: Admin pages load with a resource

**Files:**
- Modify: `apps/frontend/src/app/admin/admin-overview/admin-overview.ts`, `admin-user/admin-user.ts`, `admin-group/admin-group.ts` and their templates and specs

`AdminOverview`'s effect tracks nothing and runs once; its resource has no params. `AdminUser` and `AdminGroup` key on `userId` / `groupId`. Their optimistic `revoking` / `revoked` overlays stay as they are. `retry()` becomes `resource.reload()`.

- [ ] **Step 1: Migrate the three pages; existing specs must pass unchanged except for setup**

Run: `pnpm --filter @ardoise/frontend test -- admin && pnpm --filter @ardoise/frontend typecheck`

- [ ] **Step 2: Commit**

```bash
git commit -m "Admin pages load with resources"
```

### Task 5: Home and AcceptInvite load with resources

**Files:**
- Modify: `apps/frontend/src/app/home/home/home.ts`, `.html`, `.spec.ts`
- Modify: `apps/frontend/src/app/invite-link/accept-invite/accept-invite.ts`, `.html`, `.spec.ts`

**Home:** `groups` is a resource whose stream taps `openLastGroupOnLaunch` (a side effect on the response, the same way `PagedList` keeps pages, no effect needed). `balances` is a resource mapped to the `ReadonlyMap`; on error it reads as empty, as today. Realtime and resync call `reload()` on the right resource. `retry()` and `refresh()` both `reload()`: the resource keeps showing groups while reloading, which is today's "silent" refresh. Delete both counters.

**AcceptInvite:** `preview` is a resource on `token` whose stream resolves `{ groupName, loggedIn }` (`currentUser()` mapped to `true`, its error to `false`). The screen state is a `computed` of the preview's load state and an `action` signal (`'idle' | 'success' | 'error' | 'cancelled'`) that plan 01's attempts write. No token → `invalid`; `isUnreachable` → `couldNotLoad`; other error → `invalid`. Delete the effect and `loadPreview`; the `couldNotLoad` retry calls `preview.reload()`.

- [ ] **Step 1: Add `shows could-not-load when offline and loads on retry` to the accept-invite spec, see it fail if not already covered**
- [ ] **Step 2: Migrate both pages; run their specs and typecheck**

Run: `pnpm --filter @ardoise/frontend test -- home accept-invite && pnpm --filter @ardoise/frontend typecheck`

- [ ] **Step 3: Full verification and commit**

Run: `pnpm verify`

```bash
git commit -m "Home and invite preview load with resources"
```

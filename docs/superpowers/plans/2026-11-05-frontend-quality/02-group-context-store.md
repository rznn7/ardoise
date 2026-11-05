# 02 Group Context Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A group's `group`, `members` and `me` are fetched once, cached per group, kept fresh by realtime, and read by every screen; "which member am I" and "is this a 403/404" are each written once.

**Architecture:** `GroupContextStore` is application state shared by several screens: it belongs in a root store, like `FeedStore`, not in each component. It owns the realtime reactions that keep members fresh (today in `GroupPage`). Two pure helpers sit beside it: `findMyMember` in the member context (a rule about members, no Angular) and the HTTP status predicates in `shared/` (transport detail, used everywhere). This plan migrates `GroupPage` and `paymentFlowGuard`; plan 03 migrates the details pages while rewriting their loading.

**Tech Stack:** Angular 22 signals, RxJS 7, vitest.

**Spec:** `README.md` finding 02

## Global Constraints

- Forbidden means HTTP 403 or 404, exactly as `isNotAccessible` does today.
- Realtime events: `member.joined` (has `groupId`, `userId`) and `RealtimeService.resynced`.
- The cache is per signed-in user: it empties on `AuthService.signedOut`.
- Keyed stores may keep a "latest request per key" guard; components may not (plan 03).

## Review Focus

1. Sign out, sign in as someone else, open the same group: the old `me` must not show. Pinned in Task 3 (`forgets everything on sign-out`).
2. A members response arriving after a newer one: the older must not overwrite. Pinned in Task 3.
3. Group revalidation fails while the page shows data: the page keeps its data and the pull-to-refresh reports the failure. Pinned in Task 3.
4. Returning to a group from a payment: no group/members request is made (cache hit). Pinned in Task 4.
5. Deep link to `/group/:id/payments/new/amount` for a group I am not in: redirect to the group page, as today. Pinned in Task 4.

---

### Task 1: HTTP status predicates

**Files:**
- Create: `apps/frontend/src/app/shared/http-status.ts`
- Test: `apps/frontend/src/app/shared/http-status.spec.ts`
- Modify: `group-page.ts`, `payment-details.ts`, `settlement-details.ts`, `admin-user.ts`, `admin-group.ts`, `realtime.service.ts`, `accept-invite.ts`, `apps/frontend/eslint.config.js`, `apps/frontend/CLAUDE.md`

**Interfaces:**
- Produces: `isNotAccessible(error: unknown): boolean` (403, 404), `isNotFound(error: unknown): boolean` (404), `isUnauthorized(error: unknown): boolean` (401), `isUnreachable(error: unknown): boolean` (status 0). All false for anything that is not an `HttpErrorResponse`.

- [ ] **Step 1: Write the table test**

```ts
it.each([
  [403, { notAccessible: true, notFound: false }],
  [404, { notAccessible: true, notFound: true }],
  [500, { notAccessible: false, notFound: false }],
])('classifies %i', (status, expected) => {
  const error = new HttpErrorResponse({ status });
  expect(isNotAccessible(error)).toBe(expected.notAccessible);
  expect(isNotFound(error)).toBe(expected.notFound);
});
it('treats non-HTTP errors as none of them', () => {
  expect(isNotAccessible(new Error('x'))).toBe(false);
  expect(isUnreachable(new Error('x'))).toBe(false);
});
```

- [ ] **Step 2: Run it, see it fail, implement, run it again**

Run: `pnpm --filter @ardoise/frontend test -- http-status`
Expected: FAIL (module missing), then PASS.

- [ ] **Step 3: Replace every local check with the predicates**

Delete the three local `isNotAccessible` copies and every inline `error instanceof HttpErrorResponse && error.status === …`.

- [ ] **Step 4: Lint guard**

In `eslint.config.js`, a block for `src/app/**/*.ts`, ignoring `src/app/shared/http-status.ts` and `**/*.spec.ts`, with:

```js
const HTTP_STATUS_HELPERS = {
  selector: "BinaryExpression[operator='instanceof'][right.name='HttpErrorResponse']",
  message: 'Use the predicates in src/app/shared/http-status.ts.',
};
// in the block: 'no-restricted-syntax': ['error', HTTP_STATUS_HELPERS]
```

This is the first restriction constant; later plans add theirs the same way (README, "How to write the lint restrictions").

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test`

```bash
git add apps/frontend
git commit -m "HTTP status predicates in one place"
```

### Task 2: `findMyMember`

**Files:**
- Create: `apps/frontend/src/app/member/my-member.ts`
- Modify: `balance/balance-rows.ts`, `settlement/settlement-label.ts`, `payment/payment-meta.ts`, `payment/payment-details/payment-details.ts`, `expense-group/group-page/group-page.ts`

**Interfaces:**
- Produces: `findMyMember(members: readonly GroupMember[], meUserId: number): GroupMember | undefined`

- [ ] **Step 1: Implement and replace every `members.find((member) => member.userId === …)`**

No new spec: the callers' specs (`balance-rows`, `settlement-label`, `payment-meta`) already cover "me" and "not a member".

- [ ] **Step 2: Verify and commit**

Run: `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck`

```bash
git add apps/frontend/src/app
git commit -m "One helper finds my member in a group"
```

### Task 3: `GroupContextStore`

**Files:**
- Create: `apps/frontend/src/app/expense-group/group-context-store.ts`
- Test: `apps/frontend/src/app/expense-group/group-context-store.spec.ts`

**Interfaces:**
- Consumes: `isNotAccessible`, `findMyMember`, `ExpenseGroupApiService.findOne`, `MemberApiService.listByGroup`, `AuthService.currentUser()` / `.signedOut`, `RealtimeService.events` / `.resynced`.
- Produces:

```ts
export interface GroupContext {
  readonly group: ExpenseGroupSummary;
  readonly members: readonly GroupMember[];
  readonly me: MeResponse;
  readonly myMember: GroupMember | undefined;
}
export type GroupContextState =
  | { readonly status: 'loading' }
  | { readonly status: 'forbidden' }
  | { readonly status: 'error' }
  | ({ readonly status: 'loaded' } & GroupContext);

class GroupContextStore {
  contextOf(groupId: number): GroupContextState;               // 'loading' when unknown
  refreshStateOf(groupId: number): 'idle' | 'loading' | 'error';
  ensure(groupId: number): Observable<GroupContext>;           // cached value, or fetch; one emission then complete; errors propagate after setting forbidden/error
  revalidate(groupId: number): void;                           // refetch, keep loaded data on failure, report through refreshStateOf
}
```

- [ ] **Step 1: Write the failing spec**

Fake the three APIs and a `Subject`-backed `RealtimeService`. Tests and their assertions:

- `fetches once for two ensure calls`: two `ensure(1)` subscriptions → `findOne` and `listByGroup` called once each; `contextOf(1).status === 'loaded'`.
- `reports forbidden on 403 and 404 and error otherwise`: `ensure(1)` errors; `contextOf(1).status` is `'forbidden'` / `'error'`.
- `exposes my member`: `contextOf(1)` has `myMember.id` of the member whose `userId === me.id`.
- `refetches members when someone joins a loaded group`: emit `member.joined` for group 1 → `listByGroup` called again → new member in `contextOf(1).members`.
- `ignores joins for groups it has not loaded`: emit for group 2 → no call.
- `refetches members of loaded groups after a resync`.
- `drops a stale members response`: two joins, first response resolves last → `members` is the second response.
- `keeps the context when revalidation fails`: `revalidate(1)` with `findOne` erroring → still `'loaded'`, `refreshStateOf(1) === 'error'`.
- `forgets everything on sign-out`: emit `signedOut` → `contextOf(1).status === 'loading'`, next `ensure(1)` fetches again.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @ardoise/frontend test -- group-context-store`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

State in one `signal<ReadonlyMap<number, GroupContextState>>` and one for refresh states. `ensure` uses `defer` so the cache check happens at subscription. Subscriptions to realtime and auth use `takeUntilDestroyed()`.

- [ ] **Step 4: Run spec and typecheck; commit**

Run: `pnpm --filter @ardoise/frontend test -- group-context-store && pnpm --filter @ardoise/frontend typecheck`

```bash
git add apps/frontend/src/app/expense-group/group-context-store*
git commit -m "Group context store caches group, members and me per group"
```

### Task 4: GroupPage and the payment flow guard read the store

**Files:**
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `group-page.html`, `group-page.spec.ts`
- Modify: `apps/frontend/src/app/expense-group/group-page/group-visit.ts`
- Modify: `apps/frontend/src/app/payment/payment-form/payment-flow.guard.ts`, `payment-flow.guard.spec.ts`
- Modify: `apps/frontend/CLAUDE.md`

**Interfaces:**
- Consumes: Task 3's `GroupContextStore`.
- Produces: `GroupVisit` reduced to `{ scrollTop: number; settledVersion: number }`.

- [ ] **Step 1: Add the cache-hit test to `group-page.spec.ts`**

`does not refetch the group when coming back from a payment`: open group 1, navigate to `payments/5`, navigate back → `findOne` and `listByGroup` each called once in total.

- [ ] **Step 2: Migrate GroupPage**

`groupState` becomes `computed(() => this.context.contextOf(this.groupId()))`. `open()` calls `ensure(groupId)` piped through `takeUntilDestroyed`, with `next: () => this.lastGroup.remember(groupId)` and `error: () => undefined` (the store holds the state). `retryGroup()` does the same. `refresh()` calls `revalidate`; `groupRefresh` reads `refreshStateOf`. Delete `fetchGroup`, `loadGroup`, `refetchMembers`, `latestMembersFetch`, and the `member.joined` / `resynced` subscriptions. `isModerator` and `myBalance` read `myMember`. `resume()` additionally requires `contextOf(groupId).status === 'loaded'`; `GroupVisit` stops storing `group`, `members`, `me`.

- [ ] **Step 3: Migrate the guard**

Both branches replace `group`, `members` and `me` in their `forkJoin` with `inject(GroupContextStore).ensure(groupId)`. "Not a member" is `myMember === undefined`.

- [ ] **Step 4: Append to `apps/frontend/CLAUDE.md` under `## State`**

```markdown
- A group's `group`, `members`, `me` and `myMember` come from `GroupContextStore`; never fetch them in a component or guard.
- HTTP statuses are read through `src/app/shared/http-status.ts` (lint enforces it).
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/e2e test:e2e`
Expected: all green; Playwright scenarios unchanged.

```bash
git add apps/frontend
git commit -m "Group page and payment flow read the group context store"
```

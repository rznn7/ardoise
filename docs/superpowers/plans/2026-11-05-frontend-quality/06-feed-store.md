# 06 Feed Store and Paged List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `FeedStore` keeps its behaviour with less bookkeeping: immutable collection updates written once, "refetch if mutated in flight" owned by `PagedList` with a bound, and the optimistic merge as a pure, tested function.

**Architecture:** Three moves, each to the layer that owns it. Immutable `Map`/`Set` updates are generic utilities (`shared/collections.ts`). Refetching a page that raced a mutation is a pagination concern, so it lives in `PagedList`, which already has the `version` option for its walk. Merging server items with optimistic rows is a pure rule (the frontend's domain): `feed/feed-merge.ts`, unit-tested without Angular. `FeedStore` is left as the application layer: it calls the API, records optimistic intent, and asks the pure function what to show.

Deliberately not changed: `tombstones` and `eventCounts` grow by a few strings and numbers per mutation in a session; bounding them is not worth the risk.

**Tech Stack:** Angular 22 signals, RxJS 7, vitest.

**Spec:** `README.md` finding 06

## Global Constraints

- Feed order stays `newestFirst`: date descending, payments before settlements on the same instant, then id descending.
- Pending rows are shown above the page boundary only (rows older than the last loaded item are cut until "load more").
- Refetch-on-race gives up after 3 retries and keeps the last page (same bound as `MAX_WALK_RESTARTS`).

## Review Focus

1. A mutation settling while a page is in flight, repeatedly (a busy group): the page eventually shows, no endless refetch. Pinned in Task 2.
2. A pending payment older than the loaded boundary: hidden until more pages load, as today. Pinned in Task 3.
3. An update to a payment that is also being deleted: hidden (delete wins), as today. Pinned in Task 3.
4. `withoutEntry` on a missing key returns the same instance, so signals do not notify for nothing. Pinned in Task 1.
5. A pending settlement row: `createdByMemberId` is my member, not 0. Pinned in Task 4.

---

### Task 1: Immutable collection helpers

**Files:**
- Create: `apps/frontend/src/app/shared/collections.ts`, `collections.spec.ts`
- Modify: `feed/feed-store.ts`, `settlement/done-store.ts`, `balance/balance-store.ts`, `admin/admin-user/admin-user.ts`, `admin/admin-group/admin-group.ts`, `payment/payment-form/options-step.ts`, `apps/frontend/CLAUDE.md`

**Interfaces:**
- Produces:

```ts
withEntry<K, V>(map: ReadonlyMap<K, V>, key: K, value: V): ReadonlyMap<K, V>;
withoutEntry<K, V>(map: ReadonlyMap<K, V>, key: K): ReadonlyMap<K, V>;   // same instance when absent
withMember<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T>;              // same instance when present
withoutMember<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T>;           // same instance when absent
toggled<T>(set: ReadonlySet<T>, value: T): ReadonlySet<T>;
```

- [ ] **Step 1: Spec**: each function leaves its input unchanged, returns a new instance on change, and the same instance in the no-op cases above.
- [ ] **Step 2: Run, see it fail, implement, see it pass**

Run: `pnpm --filter @ardoise/frontend test -- collections`

- [ ] **Step 3: Replace every `new Map(x).set(...)`, `new Set(x).add(...)` and copy-then-delete in the listed files; delete `withoutKey` and `withTextOf`**
- [ ] **Step 4: Append to `apps/frontend/CLAUDE.md` under `## Reuse`**

```markdown
- Immutable `Map`/`Set` updates for signals go through `src/app/shared/collections.ts`.
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/frontend typecheck`

```bash
git commit -m "Immutable collection helpers replace hand-written copies"
```

### Task 2: PagedList refetches a raced page, with a bound

**Files:**
- Modify: `apps/frontend/src/app/shared/paged-list.ts`, `paged-list.spec.ts`
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `apps/frontend/src/app/settlement/done-store.ts`

**Interfaces:**
- Produces: `PagedList` applies `options.version` to every page fetch, not only to walks. `MAX_FETCH_RETRIES = 3`. `FeedStore.fetchSettled` and `DoneStore.fetchSettled` are deleted; both pass the API call straight as `fetch`.

- [ ] **Step 1: Failing tests in `paged-list.spec.ts`**

- `refetches a page when the version changes while it loads`: version bumps between request and response → `fetch` called twice for the same cursor; the second page is kept.
- `keeps the page after three refetches`: version bumps on every response → `fetch` called 4 times, then the state is `loaded` with the last page.

- [ ] **Step 2: Run, see them fail, implement inside the `rxResource` stream, see them pass**

Run: `pnpm --filter @ardoise/frontend test -- paged-list feed-store done-store`

- [ ] **Step 3: Delete both `fetchSettled`; typecheck; commit**

```bash
git commit -m "Paged list owns refetching a page that raced a mutation"
```

### Task 3: The optimistic merge is a pure function

**Files:**
- Create: `apps/frontend/src/app/feed/feed-merge.ts`, `feed-merge.spec.ts`
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface Optimistic {
  readonly creating: ReadonlyMap<number, FeedRow>;
  readonly recording: ReadonlyMap<number, PendingSettlement>;
  readonly deleting: ReadonlySet<number>;
  readonly undoing: ReadonlySet<number>;
  readonly updating: ReadonlyMap<number, UpdatePaymentBody>;
}
export const NO_OPTIMISTIC: Optimistic;
export const newestFirst: (a: FeedItem, b: FeedItem) => number;   // moved from feed-store.ts
export const keyOf: (item: FeedItem) => string;                    // moved from feed-store.ts
export function mergeFeed(
  groupId: number,
  items: readonly FeedItem[],
  boundary: FeedItem | undefined,
  optimistic: Optimistic,
): readonly FeedRow[];
```

`FeedStore` replaces its five overlay signals with one `signal<Optimistic>(NO_OPTIMISTIC)`, and `feedOf` becomes "page state, then `mergeFeed`".

- [ ] **Step 1: `feed-merge.spec.ts`**, cases with literal values:
  - deleting payment 2 hides it; undoing settlement 3 hides it;
  - updating payment 1 shows the new title and amount;
  - a creating row for group 1 appears in order, one for group 2 does not;
  - a pending row older than `boundary` is cut;
  - a payment both updating and deleting is hidden.
- [ ] **Step 2: Run, see it fail, implement, see it pass**

Run: `pnpm --filter @ardoise/frontend test -- feed-merge`

- [ ] **Step 3: Rewire `FeedStore`; `feed-store.spec.ts` passes unchanged except for imports**
- [ ] **Step 4: Typecheck and commit**

```bash
git commit -m "Optimistic feed merge as a pure function"
```

### Task 4: Pending settlements carry their author

**Files:**
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`

**Interfaces:**
- Produces: `FeedStore.recordSettlement(body: CreateSettlementBody, createdByMemberId: number): void`.

- [ ] **Step 1: Test** `the pending settlement row names its author`: `recordSettlement(body, 7)` → the pending row's `settlement.createdByMemberId === 7`.
- [ ] **Step 2: Implement; `GroupPage.recordSettlement` passes `myMember.id` from the group context and returns early without one**
- [ ] **Step 3: Full check and commit**

Run: `pnpm verify`

```bash
git commit -m "Pending settlements carry their author"
```

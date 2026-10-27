# Feed Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The group feed and the Done repayments arrive in pages of 50 that load on their own at the bottom; going back from a details screen keeps your place; pulling down at the top refreshes the group.

**Architecture:** A pure cursor rule in a backend shared kernel (`src/shared/pagination/`), used by the read-only `feed/` context and by a new list query in `settlement/`. Contracts gain an optional `query` schema and a `pageSchema(item)` envelope. On the frontend, `FeedStore` keeps the active group's pages in an `rxResource` driven by a cursor signal, a new `DoneStore` holds the Done repayments, a `LoadMore` sentinel and a `PullToRefresh` gesture join `shared/ui`, and the group page remembers its state for the way back.

**Tech Stack:** NestJS 12, Drizzle + PostgreSQL, Zod (`@ardoise/shared`), Angular 22 signals, spartan helm (spinner), vitest, testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-feed-pagination-design.md`

## Global Constraints

- Page size 50, fixed by the server, no `limit` parameter.
- Order: date desc, then payments before repayments at the same instant, then id desc (`newestFirst` in `apps/backend/src/feed/domain/feed.ts`). Repayments alone: `settledAt` desc, id desc.
- Response envelope `{ items, nextCursor: string | null }`. Cursor opaque to the client. Invalid cursor → 400 `{ error: 'INVALID_CURSOR' }`. Non-member → 403 as today.
- Automatic loading at the bottom, never a "Load more" button. No end-of-list line.
- Going back from a group child route renders kept state with no request and restores scroll; opening from home or by URL is a fresh visit (first page, top, Payments tab).
- Pull to refresh only on the group page. Failed refresh keeps the rows, toast "Couldn't refresh the group".
- Done hides repayments still saving (today's behaviour).
- Frontend templates: helm + `shared/ui`, Tailwind layout only, text directives, no arbitrary values, no component CSS. New building blocks are called out in the PR.
- Commits: one line, no body, no trailers. `pnpm typecheck` before calling a task done.

## Review Focus

- Items sharing the same timestamp across a page boundary, payment and repayment at the same instant included: none skipped, none repeated. → Task 1 unit `ties`, Task 2 e2e `walks every page once`.
- Postgres keeps microseconds, a JS `Date` cursor keeps milliseconds: a row at `…123456µs` must not be skipped or repeated. → Task 2: compare on `date_trunc('milliseconds', col)`; e2e `sub-millisecond timestamps` seeds two settlements 300µs apart in the same ms.
- A payment created or edited with a date older than everything loaded must not show at the end of the loaded list and then again when its page arrives. → Task 4 spec `hides rows past the boundary` and `dedupes an appended page`.
- Reaching the bottom while a page request is in flight, or after the end: no second request. → Task 5 spec.
- A refresh or fresh visit racing an in-flight next page: the stale page must not append to the fresh list. → Task 4 spec `a refresh during loadMore keeps only the fresh first page`.

---

### Task 1: Cursor rule and contracts

The cursor is a pure ordering rule shared by two contexts. Neither `feed` nor `settlement` should import the other, so it lives in a backend shared kernel, `src/shared/pagination/`, with no Nest or Drizzle import (same rules as a `domain/` folder).

**Files:**
- Create: `apps/backend/src/shared/pagination/cursor.ts`, `cursor.spec.ts`
- Modify: `apps/backend/src/feed/domain/feed.ts` (export `cursorOf(item: FeedItem): Cursor`)
- Modify: `libs/shared/src/contracts/http.ts`, `feed.ts`, `settlement.ts`, create `libs/shared/src/contracts/page.ts`, `index.ts`
- Modify: `apps/frontend/src/app/shared/api-client.ts` (+ its spec if any)

**Interfaces:**
- Produces (backend, `src/shared/pagination/cursor.ts`):
  - `PAGE_SIZE = 50`
  - `type Cursor = { readonly date: Date; readonly rank: 0 | 1; readonly id: number }` (rank 0 payment, 1 settlement).
  - `encodeCursor(cursor: Cursor): string` (base64url of JSON `[isoDate, rank, id]`), `decodeCursor(raw: string): Cursor` throws `InvalidCursor` on anything malformed (bad base64, not a 3-tuple, invalid date, rank not 0/1, id not a positive int).
  - `isAfter(cursor: Cursor, item: Cursor): boolean` — true when `item` comes strictly after `cursor` in the global order (date desc, rank asc, id desc).
  - `class InvalidCursor extends Error`.
- Produces (shared): `Endpoint.query?: z.ZodType`; `pageQuerySchema = z.object({ cursor: z.string().min(1).optional() }).strict()`; `pageSchema(item)` → `z.object({ items: z.array(item), nextCursor: z.string().nullable() })`; `feedApi.listByGroup` gets `query: pageQuerySchema`, `res: pageSchema(feedItemSchema)`; `settlementApi.listByGroup = { GET /expense-groups/:groupId/settlements, query: pageQuerySchema, res: pageSchema(settlementResponseSchema) }`; `paginationErrorSchema = z.object({ error: z.enum(['INVALID_CURSOR']) })`; `FeedPage`, `SettlementPage` types.
- Produces (frontend): client methods accept `{ query?: z.input<E['query']> }` when the endpoint has a `query`, sent as `HttpParams`, `undefined` values omitted.

- [ ] **Step 1: Write `cursor.spec.ts`**: `encode then decode round-trips`; `decode rejects` each malformed case listed above with `InvalidCursor`; `isAfter` table: older date → true; newer → false; same date, payment cursor vs settlement item → true; same date, settlement cursor vs payment item → false; same date and rank, lower id → true, equal id → false, higher id → false.
- [ ] **Step 2: Run** `pnpm --filter @ardoise/backend test -- cursor` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement `cursor.ts`.**
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Contracts and client.** Add the shared schemas above; in `api-client.ts` add a `QueryArg<E>` to `RequestArg<E>` and pass `params` to `http.request`. The backend feed controller and the frontend feed callers stay red until Tasks 2 and 4 fix them; here run only `pnpm --filter @ardoise/shared typecheck`. Expected: clean.
- [ ] **Step 6: Commit** `feat(pagination): cursor rule and paged contracts`

### Task 2: Paged group feed (backend)

**Files:**
- Modify: `apps/backend/src/feed/domain/feed-repository.ts`, `feed/application/list-group-feed.use-case.ts`, `feed/infrastructure/feed-repository.drizzle.ts`, `feed.controller.ts`
- Create: `apps/backend/src/shared/http/pagination-exception.filter.ts` (register in `app.module.ts` like the others)
- Modify: `apps/backend/src/shared/database/schema.ts` + generated migration (`pnpm --filter @ardoise/backend db:generate </dev/null`, never hand-edit)
- Test: `apps/backend/test/list-group-feed.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 `Cursor`, `PAGE_SIZE`, `isAfter`, `encodeCursor`, `decodeCursor`, `InvalidCursor`, `cursorOf`.
- Produces: `FeedRepository.findPage(groupId: number, after: Cursor | null, size: number): Promise<FeedItem[]>` (returns up to `size` items, already merged and ordered); `ListGroupFeedUseCase.execute({ userId, groupId, cursor: string | undefined }): Promise<{ items: FeedItem[]; nextCursor: string | null }>`.
- The use case asks for `PAGE_SIZE + 1`, returns 50, and sets `nextCursor = encodeCursor(cursorOf(last returned))` when a 51st existed. Decoding happens in the use case (a domain rule), the controller only passes the raw string.
- Repository: one query per table, each `ORDER BY` the global order and `LIMIT size`, merged with `newestFirst`, sliced to `size`. "After" in SQL, with `d = date_trunc('milliseconds', col)`:
  - payment (rank 0): `d < c.date OR (d = c.date AND c.rank = 0 AND id < c.id)`
  - settlement (rank 1): `d < c.date OR (d = c.date AND (c.rank = 0 OR id < c.id))`
- Schema: `index('payment_group_paid_at_idx').on(groupId, paidAt, id)`, `index('settlement_group_settled_at_idx').on(groupId, settledAt, id)`.

- [ ] **Step 1: Rewrite the e2e spec's existing cases to the envelope, and add:** `returns the first 50 and a cursor` (seed 51 payments: 50 items, `nextCursor` string); `walks every page once` (seed 120 payments and 15 settlements, 30 of them sharing one `paidAt`, and a payment and a settlement at the same instant; follow `nextCursor` until `null`; the concatenated ids equal the full list sorted by the global order, no duplicates); `last page has a null cursor`; `sub-millisecond timestamps` (two settlements with `settled_at` set by SQL to `…:00.123100` and `…:00.123400`, page size forced by seeding 49 newer payments so the boundary falls between them: both appear once); `rejects an invalid cursor` (400 `{ error: 'INVALID_CURSOR' }`); `refuses a non-member` (403, unchanged).
- [ ] **Step 2: Run** `pnpm --filter @ardoise/backend test:e2e -- list-group-feed` — Expected: FAIL (array body, no cursor).
- [ ] **Step 3: Implement** the port, repository, use case, controller (`@Query(new ZodValidationPipe(feedApi.listByGroup.query))`), filter, indexes; generate the migration.
- [ ] **Step 4: Run** the same — Expected: PASS. Then `pnpm --filter @ardoise/backend typecheck` — Expected: clean.
- [ ] **Step 5: Commit** `feat(feed): pages of 50 with a cursor`

### Task 3: Repayments of a group (backend)

**Files:**
- Modify: `apps/backend/src/settlement/domain/settlement-repository.ts`, `settlement-repository.drizzle.ts`, `settlement.controller.ts`, `settlement.module.ts`
- Create: `apps/backend/src/settlement/application/list-group-settlements.use-case.ts`
- Test: create `apps/backend/test/list-group-settlements.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1, and the settlement rank (1) for `Cursor`.
- Produces: `SettlementRepository.findPageByGroup(groupId: number, after: Cursor | null, size: number): Promise<Settlement[]>`; `ListGroupSettlementsUseCase.execute({ userId, groupId, cursor })` → `{ items: Settlement[]; nextCursor: string | null }`; route `settlementApi.listByGroup`. Membership check via `MEMBER_REPOSITORY` → `NotAMember`.

- [ ] **Step 1: Write the spec:** `lists repayments newest first, 50 per page`; `walks every page once` (60 settlements, 20 sharing a `settledAt`); `last page has a null cursor`; `rejects an invalid cursor`; `refuses a non-member`; `only this group's repayments`.
- [ ] **Step 2: Run** `pnpm --filter @ardoise/backend test:e2e -- list-group-settlements` — Expected: FAIL (404 route).
- [ ] **Step 3: Implement.** Same SQL rule as the settlement half of Task 2.
- [ ] **Step 4: Run** — Expected: PASS; backend typecheck clean.
- [ ] **Step 5: Commit** `feat(settlement): list a group's repayments by page`

### Task 4: FeedStore pages and DoneStore (frontend)

**Files:**
- Modify: `apps/frontend/src/app/feed/feed-store.ts`, `feed-store.spec.ts`, `feed-api.service.ts`, `apps/frontend/src/app/settlement/settlement-api.service.ts`
- Create: `apps/frontend/src/app/settlement/done-store.ts`, `done-store.spec.ts`

**Interfaces:**
- Consumes: Task 1 contracts (`FeedPage`, `SettlementPage`, client `query`).
- Produces:
  - `FeedApiService.listByGroup(groupId: number, cursor?: string): Observable<FeedPage>`; `SettlementApiService.listByGroup(groupId: number, cursor?: string): Observable<SettlementPage>`.
  - `FeedState` loaded variant gains `more: 'idle' | 'loading' | 'error' | 'end'`.
  - One active group per store (the owner's pick: `rxResource`, which holds one set of params). `FeedStore.feed(groupId)` returns `loading` for any group that is not the active one.
  - `FeedStore.loadFirst(groupId)` (replaces `load`: makes `groupId` active and fetches page 1, replacing kept pages; if `groupId` is already active with only page 1, `reload()`), `FeedStore.loadMore()` (sets the cursor to `nextCursor`; no-op unless `more` is `idle`), `FeedStore.retryMore()` (`reload()` of the failed page), `FeedStore.hasPages(groupId): boolean`. The two internal reload paths (raced mutation, undo error) call `loadFirst`.
  - `DoneState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; settlements: readonly SettlementResponse[]; more: FeedState['more'] }`; `DoneStore.done(groupId)`, `loadFirst(groupId)`, `loadMore()`, `retryMore()`, `hasPages(groupId)`, and the hooks FeedStore calls: `added(groupId, settlement)`, `hide(id)`, `unhide(id)`, `removed(groupId, id)`. `FeedStore` injects `DoneStore`, never the other way round.
- Mechanics, both stores:
  - `active = signal<number | null>(null)`, `cursor = signal<string | undefined>(undefined)`; `page = rxResource({ params: () => active() === null ? undefined : { groupId, cursor }, stream: ({ params }) => api.listByGroup(params.groupId, params.cursor) })`. A params change unsubscribes the previous stream, so a stale page never lands: no generation counter.
  - Pages accumulate in a `linkedSignal` whose source reads `page.hasValue() ? page.value() : undefined` (`value()` throws in error): a page without cursor replaces, a page with cursor appends, deduped by kind and id. On error the accumulated list stays.
  - `more` comes from `page.isLoading()` (with a cursor set), `page.error()`, and the last page's `nextCursor === null`.
  - Server-confirmed mutations (upsert, removal) patch the accumulated list with `.update()`; optimistic overlays (`creating`, `updating`, `deleting`, `undoing`, `recording`) stay separate signals applied on top, as today.
  - While `more !== 'end'`, rows older than the last server item loaded (by the global order) are hidden: this covers a create or an edit moving a row past the boundary.

- [ ] **Step 1: Specs.** FeedStore: `loadFirst shows the first page and more idle`; `loadMore appends the next page`; `loadMore is ignored while loading and at the end`; `a failed loadMore keeps rows and sets more error, retryMore works`; `dedupes an appended page`; `hides rows past the boundary` (create a payment dated before the last loaded row: not in rows until the page holding the boundary arrives with `nextCursor: null`); `a refresh during loadMore keeps only the fresh first page`; `kept pages survive between calls to feed()`; existing optimistic specs adapted to pages. DoneStore: same paging specs; `added puts a saved repayment on top`; `hide/unhide/removed` for optimistic undo.
- [ ] **Step 2: Run** `pnpm --filter @ardoise/frontend exec ng test --watch=false --include 'src/app/feed/*.spec.ts' --include 'src/app/settlement/done-store.spec.ts'` — Expected: FAIL.
- [ ] **Step 3: Implement.** `recordSettlement` success → `done.added`; `undoSettlement` → `done.hide` at start, `done.removed` on success, `done.unhide` on error.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(feed): pages in the feed store, a Done store fed by its own endpoint`

### Task 5: Load more at the bottom (frontend)

**Files:**
- Create: `apps/frontend/src/app/shared/ui/load-more/load-more.ts`, `load-more.html`, `load-more.spec.ts`
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `group-page.html`, its spec; `apps/frontend/src/app/balance/group-balances/group-balances.ts`, `.html`, spec

**Interfaces:**
- Consumes: Task 4 stores.
- Produces: `<app-load-more [state]="more" (load)="…" (retry)="…" />` — `state: 'idle' | 'loading' | 'error' | 'end'`. Renders an `IntersectionObserver` sentinel when idle (emits `load` once per entry into view), a centered helm spinner with `aria-label="Loading more"` when loading, an inline row "Couldn't load more" + Retry button (`appError`, `hlmBtn` ghost) when error, nothing at the end.
- `GroupBalances` gains inputs `doneMore` and outputs `loadMoreDone`, `retryDone`; its `settlements` input is fed from `DoneStore.done(groupId)` by the group page.

- [ ] **Step 1: Specs.** load-more: `emits load when the sentinel enters view` (stub `IntersectionObserver` in the spec), `does not emit while loading`, `shows retry on error and emits retry`, `renders nothing at the end`. Group page: `asks for the next page at the bottom of the feed`; `a day split across pages has one header` (page 1 ends and page 2 starts on the same day); `Done comes from the Done store` (a settlement absent from the feed still shows in Done). Group balances: `asks for more Done rows at the bottom`.
- [ ] **Step 2: Run** the three spec files — Expected: FAIL.
- [ ] **Step 3: Implement**; place `<app-load-more>` after the feed's last day and after the Done list.
- [ ] **Step 4: Run** — Expected: PASS; `pnpm typecheck` clean.
- [ ] **Step 5: Commit** `feat(group): next page loads on its own at the bottom of the feed and of Done`

### Task 6: Keep your place on the way back (frontend)

**Files:**
- Create: `apps/frontend/src/app/expense-group/group-page/group-visit.ts`, `group-visit.spec.ts`
- Modify: `group-page.ts`, its spec; `apps/frontend/src/app/shared/ui/mobile-shell/mobile-shell.ts` (expose the scroll container)

**Interfaces:**
- Produces:
  - `isReturnFromChild(previousUrl: string | undefined, groupId: number): boolean` — true when `previousUrl` starts with `/group/<groupId>/` (any child route). Pure, unit tested.
  - `GroupVisitMemory` (root service): `remember(groupId, { group: GroupState & { status: 'loaded' }; scrollTop: number })`, `recall(groupId)`.
  - `MobileShell.scrollTop(): number` and `MobileShell.scrollTo(top: number): void` over `<main>`.
- GroupPage reads the previous URL from `router.currentNavigation()?.previousNavigation?.finalUrl` (or `lastSuccessfulNavigation` when no navigation is in flight). On return with a memory and kept pages in both stores: set `groupState` from memory, call no store, restore scroll with `afterNextRender`. Otherwise: fresh visit, `loadFirst` both stores, load balances and group, scroll top. On destroy, remember the loaded group state and `scrollTop`. The tab already rides in the URL query.

- [ ] **Step 1: Specs.** `isReturnFromChild`: child payment/settlement/form URLs → true; `/home`, another group's child, the group itself, `undefined` → false. Group page: `going back from details makes no request and restores the scroll`; `opening from home loads the first page`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS; typecheck clean.
- [ ] **Step 5: Commit** `feat(group): coming back from details keeps your place`

### Task 7: Pull to refresh (frontend)

**Files:**
- Create: `apps/frontend/src/app/shared/ui/pull-to-refresh/pull-to-refresh.ts`, spec
- Modify: `mobile-shell.ts`, `mobile-shell.html`, `group-page.ts`, `group-page.html`, group page spec

**Interfaces:**
- Produces: `MobileShell` inputs `refreshable = false`, `refreshing = false`, output `refresh`. The gesture lives in the `PullToRefresh` directive on `<main>`: pointer events (so a mouse drives it in Playwright), active only when `scrollTop === 0` at pointer down; the indicator (helm spinner, `aria-label="Refreshing"`) follows the pull with resistance up to a threshold (builder picks distance, ~64px), emits `refresh` when released past it, and stays while `refreshing`.
- GroupPage `refresh()`: `feedStore.loadFirst`, `doneStore.loadFirst`, `balanceStore.load`, group reload without the loading state; `refreshing` true until all four settle; any failure → toast "Couldn't refresh the group", rows kept.

- [ ] **Step 1: Specs.** Directive: `emits refresh past the threshold at the top`; `does nothing when scrolled`; `does nothing below the threshold`. Group page: `pull to refresh replaces kept pages with the first page`; `a failed refresh keeps the rows and toasts`.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS; typecheck clean.
- [ ] **Step 5: Commit** `feat(group): pull to refresh`

### Task 8: Seed, scenarios, screenshots, docs

**Files:**
- Modify: `apps/backend/scripts/seed-dev.ts` (+ `apps/backend/test/seed-dev.e2e-spec.ts` if it counts rows)
- Modify: `apps/e2e/e2e/fixtures/db.ts` (`seedPayments(groupName: string, count: number, payerName: string)` inserting payments with shares, one day apart going back), `fixtures/group.ts` (`pullToRefresh(page)`: mouse down at the top of `main`, move down 150px in steps, up)
- Create: `apps/e2e/e2e/scroll-back-to-the-oldest-payment.spec.ts`, `apps/e2e/e2e/pull-to-refresh-shows-a-new-payment.spec.ts`
- Modify: `apps/e2e/screenshots/matrix.ts`, `fixtures.ts` (envelope; cells: feed loading more, feed load-more error, Done loading more, pulling, refreshing)
- Modify: `docs/roadmap.md` (tick Feed pagination), `docs/design.md` (log `load-more` and `pull-to-refresh` building blocks)

- [ ] **Step 1: Seed:** a group "Flatshare" with 130 payments over eight months and 60 repayments. Run `pnpm --filter @ardoise/backend test:e2e -- seed-dev` — Expected: PASS.
- [ ] **Step 2: Scenarios.** `scroll back to the oldest payment`: 60 seeded payments, the oldest titled "First groceries"; scroll the feed to the bottom; "First groceries" visible; open it; go back; still visible without scrolling. `pull to refresh shows a new payment`: Alice and Bob in a group; Alice opens it; Bob adds "Taxi"; Alice pulls to refresh; `feedRow(alice, 'Taxi')` visible. Mutation check each: break the `loadMore` call, then the refresh, and watch each fail.
- [ ] **Step 3: Run** `pnpm --filter @ardoise/e2e test:e2e` — Expected: all pass (31 scenarios with PR #30 merged, else 30).
- [ ] **Step 4: Screenshots** with `pnpm dev:front` running: `pnpm --filter @ardoise/e2e screenshots` — Expected: new cells in light and dark.
- [ ] **Step 5: `pnpm verify`** — Expected: green.
- [ ] **Step 6: Commit** `test(e2e): oldest payment by scrolling, new payment by pulling`, then `docs: feed pagination in the roadmap and design log`

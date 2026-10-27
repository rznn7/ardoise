# Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record and undo repayments between two members, overlay them on balances, and show them in a unified group feed and a Done section of the Balances tab.

**Architecture:** A new `settlement/` bounded context owns the writes and the "only from or to" rule. `balance/` extends its pure net-balance formula with settled-out/settled-in totals. A new read-only `feed/` context lists payments and settlements together, replacing the group payment list. On the frontend, `PaymentStore` becomes `FeedStore` (feed items of two kinds, optimistic for both), and the Balances tab gains a confirm sheet, a Done section and an undo sheet.

**Tech Stack:** NestJS 12, Drizzle + PostgreSQL, Zod (`@ardoise/shared`), Angular 22 signals, spartan helm sheet, vitest, testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-settlement-design.md`

## Global Constraints

- Money is integer cents; settlement `amount` is an int, 0 < amount ≤ 2 147 483 647.
- Code says `settlement`; the UI says "repayment".
- Only `fromMemberId` or `toMemberId` may record or undo a settlement. Error codes: `INVALID_SETTLEMENT` (400), `SETTLEMENT_MEMBER_NOT_IN_GROUP` (400), `NOT_INVOLVED_IN_SETTLEMENT` (403), `SETTLEMENT_NOT_FOUND` (404). Non-member of the group: 403 via `NotAMember`.
- `settledAt` = server time at record. Undo = hard delete.
- Net balance = paid − owed + settledOut − settledIn. The client never recomputes balances.
- Copy (exact): sheet line "You pay Léa" / "Tom pays you"; confirm "I paid Léa back" / "Tom paid me back"; dismiss "Not yet"; feed/Done row "You paid Léa back" / "Tom paid you back" / "Tom paid Léa back"; marker "Repayment"; undo button "Undo repayment"; Done sheet dismiss "Keep it"; details confirm "Undo this repayment?" + "Everyone's balances will be updated." + "Cancel"; toasts "Couldn't record the repayment" / "Couldn't undo the repayment"; pending "Saving…"; Done section header "Done".
- Done check: lucide `lucideCircleCheck`, thin stroke, theme "owed" green, no fill.
- Frontend templates: helm + `shared/ui`, Tailwind layout only, text directives, no arbitrary values, no component CSS.
- Commits: one line, no body, no trailers.

## Review Focus

- A confirmed repayment row in Balances while its record is in flight must not be tappable (no double record). → Task 6 spec `pending repayment row is not tappable`.
- A group where all payments were deleted but a settlement remains must show balances, not "Nothing to settle yet". → Task 5 spec `hasActivity is true with only settlements`, Task 4 e2e `feed with only settlements`.
- Undo by a third member, or of an already undone settlement, must fail cleanly (403 / 404) and the UI restores the row with a toast. → Task 2 e2e, Task 5 spec `undo failure restores the row`.
- Settlement members from another group → 400, not 500 from the FK. → Task 2 e2e `members of another group`.
- Balances after a settlement that overshoots the debt flip direction and still sum to 0. → Task 3 unit `overshooting settlement flips the balance`.

---

### Task 1: Settlement domain, schema and contracts

**Files:**
- Create: `apps/backend/src/settlement/domain/settlement.ts`, `settlement.spec.ts`, `settlement-repository.ts`
- Modify: `apps/backend/src/shared/database/schema.ts` (+ generated migration via `db:generate`)
- Create: `libs/shared/src/contracts/settlement.ts`, `libs/shared/src/contracts/feed.ts`; Modify: `libs/shared/src/index.ts`

**Interfaces:**
- Produces (backend domain):
  - `type Settlement = { id; groupId; fromMemberId; toMemberId; amount; settledAt: Date; createdByMemberId; createdAt: Date }` (all readonly numbers except dates).
  - Errors: `InvalidSettlement`, `SettlementMemberNotInGroup`, `NotInvolvedInSettlement`, `SettlementNotFound` (extend `Error`).
  - `assertValidSettlement(input: { fromMemberId: number; toMemberId: number; amount: number }): void` — throws `InvalidSettlement` if `amount` not a positive integer or `from === to`.
  - `assertInvolved(settlement: { fromMemberId: number; toMemberId: number }, actorMemberId: number): void` — throws `NotInvolvedInSettlement`.
  - `SETTLEMENT_REPOSITORY`, `SettlementRepository { findById(id): Promise<Settlement | null>; create(input: Omit<Settlement, 'id' | 'createdAt' | 'settledAt'>): Promise<Settlement>; delete(id): Promise<void> }`.
- Produces (shared): `settlementResponseSchema` / `SettlementResponse` (dates as ISO strings), `createSettlementRequestSchema` (strict: `groupId, fromMemberId, toMemberId, amount`) / `CreateSettlementRequest` / `CreateSettlementBody`, `settlementErrorSchema`, `settlementApi { findOne: GET /settlements/:id, create: POST /settlements → settlementResponseSchema, delete: DELETE /settlements/:id status 204 }`; `feedItemSchema` = `z.discriminatedUnion('kind', [{ kind: 'payment', payment: paymentResponseSchema }, { kind: 'settlement', settlement: settlementResponseSchema }])`, `FeedItem`, `feedApi { listByGroup: GET /expense-groups/:groupId/feed → z.array(feedItemSchema) }`.
- Schema: table `settlement` with `id`, `groupId` → expense_group, `fromMemberId`/`toMemberId`/`createdByMemberId` → member, `amount` integer, `settledAt` timestamptz, `...timestamps`; `check('settlement_amount_positive', amount > 0)`, `check('settlement_distinct_members', from_member_id <> to_member_id)`.

- [ ] **Step 1: Write failing unit tests** in `settlement.spec.ts`: `assertValidSettlement` accepts `{1,2,3000}`; throws `InvalidSettlement` for amount 0, −5, 12.5, and `from === to`; `assertInvolved` passes for actor = from and actor = to, throws `NotInvolvedInSettlement` for a third id.
- [ ] **Step 2:** `pnpm --filter @ardoise/backend test settlement` → FAIL (module missing).
- [ ] **Step 3:** Implement domain files, the shared contracts, export them from `index.ts`, add the table, run `pnpm --filter @ardoise/backend db:generate` (never hand-edit the migration).
- [ ] **Step 4:** Unit tests PASS; `pnpm typecheck` clean.
- [ ] **Step 5:** Commit `feat(backend): settlement domain, schema and contracts`.

### Task 2: Record, find and undo settlements (backend)

**Files:**
- Create: `apps/backend/src/settlement/application/record-settlement.use-case.ts`, `undo-settlement.use-case.ts`, `get-settlement.use-case.ts`
- Create: `apps/backend/src/settlement/infrastructure/settlement.controller.ts`, `settlement.module.ts`, `settlement-repository.drizzle.ts`, `settlement.mapper.ts`
- Create: `apps/backend/src/shared/http/settlement-exception.filter.ts`; Modify: `apps/backend/src/app.module.ts`
- Modify: `apps/backend/test/helpers/seed.ts` (add `seedSettlement`)
- Test: `apps/backend/test/record-settlement.e2e-spec.ts`, `undo-settlement.e2e-spec.ts`, `find-settlement.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 domain and contracts; `MEMBER_REPOSITORY.findByGroupId`, `findByUserAndGroup`.
- Produces: `RecordSettlementUseCase.execute({ userId, groupId, fromMemberId, toMemberId, amount }): Promise<Settlement>`; `UndoSettlementUseCase.execute({ userId, settlementId }): Promise<void>`; `GetSettlementUseCase.execute({ userId, settlementId }): Promise<Settlement>`; `toSettlementResponse(s: Settlement): SettlementResponse`; `seedSettlement(pgClient, { groupId, fromMemberId, toMemberId, amount, settledAt? })`.
- Order in record: caller membership (`NotAMember`) → `assertValidSettlement` → from/to in group (`SettlementMemberNotInGroup`) → `assertInvolved(input, caller.id)` → create with `createdByMemberId = caller.id`, `settledAt = new Date()`. Undo/get: `findById` (`SettlementNotFound`) → membership of `settlement.groupId` (`NotAMember`) → for undo `assertInvolved` → delete. No unit of work: each writes one table.

- [ ] **Step 1: Write failing e2e specs** (pattern of `delete-payment.e2e-spec.ts`; TRUNCATE list adds `settlement`):
  - record: 201 as `from` (body matches, `createdByMemberId` = caller), 201 as `to`, 403 `NOT_INVOLVED_IN_SETTLEMENT` for a third member, 403 for a non-member, 400 `INVALID_SETTLEMENT` for `from = to` and for `amount: 0` (Zod or domain, either way 400), 400 `SETTLEMENT_MEMBER_NOT_IN_GROUP` for a member of another group, 401 without session.
  - find: 200 for any member of the group, 403 non-member, 404 unknown.
  - undo: 204 by `from`, 204 by `to`, 403 third member, 404 on second undo, 403 non-member.
- [ ] **Step 2:** `pnpm --filter @ardoise/backend test:e2e settlement` → FAIL (404 routes).
- [ ] **Step 3:** Implement use cases, adapter, mapper, controller (`@Route(settlementApi.*)`, `ZodValidationPipe`), module (imports `DatabaseModule, SessionModule, MemberModule`, exports nothing), filter (`@Catch` the four errors; codes above), register module + `APP_FILTER`.
- [ ] **Step 4:** e2e PASS; `pnpm typecheck`.
- [ ] **Step 5:** Commit `feat(backend): record, find and undo settlements`.

### Task 3: Balance overlay

**Files:**
- Modify: `apps/backend/src/balance/domain/balance.ts`, `net-balances.ts`, `net-balances.spec.ts`, `simplify-debts.spec.ts`
- Modify: `apps/backend/src/balance/infrastructure/balance-repository.drizzle.ts`
- Test: `apps/backend/test/group-balances.e2e-spec.ts`, `my-balances.e2e-spec.ts` (extend)

**Interfaces:**
- `MemberTotals` gains `readonly settledOut: number; readonly settledIn: number`. `netOf = paid − owed + settledOut − settledIn`. Existing spec fixtures pass `settledOut: 0, settledIn: 0`.
- Adapter adds two subqueries over `settlement` grouped by `fromMemberId` / `toMemberId`, `COALESCE(...,0)::int`.

- [ ] **Step 1: Failing unit tests**: `a settlement cancels the debt it repays` (`{1: paid 3000 owed 1500}`, `{2: paid 0 owed 1500, settledOut 1500}`, `{1 settledIn 1500}` → both 0); `overshooting settlement flips the balance` (debt 1000, settled 1500 → +500 / −500, sums to 0); `simplifyDebts` on those balances returns `[]` and the flipped transfer respectively.
- [ ] **Step 2:** FAIL. **Step 3:** implement domain + adapter.
- [ ] **Step 4: Failing → passing e2e**: group balances after `seedSettlement` show 0/0 and `transfers: []`; partial settlement leaves the remainder as one transfer; `/balances/mine` reflects a settlement.
- [ ] **Step 5:** Commit `feat(backend): settlements overlay balances`.

### Task 4: Group feed (backend), replacing the group payment list

**Files:**
- Create: `apps/backend/src/feed/domain/feed.ts`, `feed-repository.ts`; `apps/backend/src/feed/application/list-group-feed.use-case.ts`; `apps/backend/src/feed/infrastructure/feed.controller.ts`, `feed.module.ts`, `feed-repository.drizzle.ts`
- Modify: `apps/backend/src/app.module.ts`
- Delete: `apps/backend/src/payment/application/list-group-payments.use-case.ts`, `apps/backend/src/payment/infrastructure/group-payment.controller.ts`, `paymentApi.listByGroup` in `libs/shared/src/contracts/payment.ts`, `findByGroupId` on `PaymentRepository` if unused after (grep), `apps/backend/test/list-group-payments.e2e-spec.ts` (its cases move to the feed spec)
- Test: `apps/backend/test/list-group-feed.e2e-spec.ts`

**Interfaces:**
- Domain: `type FeedItem = { kind: 'payment'; payment: Payment } | { kind: 'settlement'; settlement: Settlement }`; `FEED_REPOSITORY`, `FeedRepository { findByGroupId(groupId: number): Promise<FeedItem[]> }`. Ordered by item date desc (`paidAt` / `settledAt`), then id desc within kind; payments before settlements on exact ties (my call, deterministic).
- `ListGroupFeedUseCase.execute({ userId, groupId }): Promise<FeedItem[]>` (membership → read).
- Controller maps with `toPaymentResponse` / `toSettlementResponse`.
- The adapter may run two queries and merge in memory (simplest with Drizzle typing); keep the sort in one helper so a cursor can be added later.

- [ ] **Step 1: Failing e2e**: 403 non-member, 401 no session, empty array for an empty group, mixed ordering (payment yesterday, settlement today, payment tomorrow → tomorrow, today, yesterday with correct `kind`s), `feed with only settlements` returns them, payments from other groups excluded.
- [ ] **Step 2:** FAIL. **Step 3:** implement, delete the old list endpoint and spec. **Step 4:** `pnpm --filter @ardoise/backend test:e2e` all PASS; `pnpm typecheck` (frontend will break on `listByGroup` until Task 5 — run typecheck for backend + shared only here).
- [ ] **Step 5:** Commit `feat(backend): group feed of payments and settlements`.

### Task 5: FeedStore (frontend) and repayments in the feed

**Files:**
- Move: `apps/frontend/src/app/payment/payment-store.ts` → `apps/frontend/src/app/feed/feed-store.ts` (+ spec), class `FeedStore`
- Create: `apps/frontend/src/app/feed/feed-api.service.ts`, `apps/frontend/src/app/settlement/settlement-api.service.ts`, `apps/frontend/src/app/settlement/settlement-label.ts` (+ spec)
- Modify: `payment-api.service.ts` (drop `listByGroup`), `payment-details.ts`, `group-page.ts/.html` (+ spec)

**Interfaces:**
- `FeedRow = { kind: 'payment'; payment: PaymentResponse; pending: boolean } | { kind: 'settlement'; settlement: SettlementResponse; pending: boolean }`; `FeedState` loaded variant is `{ status: 'loaded'; rows: readonly FeedRow[] }`. Sort newest first by date (`paidAt` / `settledAt`), then id desc.
- Keeps existing payment API (`create`, `update`, `remove`, `pendingUpdate`, `confirmedUpdate`, `settledVersion`, `load`). Adds:
  - `recordSettlement(body: CreateSettlementBody): void` — optimistic row with temporary negative id, `settledAt = now`, `pending: true`; on success upsert; on error drop + toast "Couldn't record the repayment"; `markSettled` either way.
  - `undoSettlement(groupId: number, id: number): void` — hides the row; on success removes; on error restores + toast "Couldn't undo the repayment"; `markSettled`.
  - `pendingSettlements(groupId): Signal<readonly CreateSettlementBody[]>` for the Balances tab.
- `settlementLabel(s: { fromMemberId; toMemberId }, members, meUserId): string` → "You paid Léa back" / "Tom paid you back" / "Tom paid Léa back" (`nameOf` fallback "Someone", as in `balance-rows.ts`).
- Group page: `hasPayments` → `hasActivity` = any non-pending row of either kind. Feed template renders settlement rows: title = `settlementLabel`, meta = "Repayment" (or "Saving…" when pending), trailing amount in ink, link `['settlements', id]` when not pending. Empty state only when `rows.length === 0`.

- [ ] **Step 1: Failing specs**: `feed-store.spec.ts` — existing payment cases ported to `rows`; `recordSettlement shows a pending row then the confirmed one`; `record failure drops the row and toasts`; `undo hides then removes`; `undo failure restores the row`; `pendingSettlements lists in-flight records`. `settlement-label.spec.ts` — three wordings. `group-page.spec.ts` — `hasActivity is true with only settlements`; settlement row shows label + "Repayment".
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `pnpm --filter @ardoise/frontend test` PASS, `pnpm typecheck` clean.
- [ ] **Step 5:** Commit `feat(frontend): feed store with repayments in the group feed`.

### Task 6: Balances tab — confirm sheet, Done section, undo sheet

**Files:**
- Modify: `apps/frontend/src/app/balance/balance-rows.ts` (+ spec), `balance/group-balances/group-balances.ts/.html` (+ spec), `group-page.ts/.html` (wire inputs/outputs)

**Interfaces:**
- `RepaymentRow` gains `fromMemberId`, `toMemberId`, `sheetLine` ("You pay Léa" / "Tom pays you"), `confirmLabel` ("I paid Léa back" / "Tom paid me back"; only for mine), `pending: boolean` (a pending settlement with the same from/to/amount exists). `repaymentRows(transfers, members, meUserId, pending: readonly CreateSettlementBody[])`.
- `doneRows(settlements: readonly SettlementResponse[], members, meUserId): DoneRow[]` with `{ id, label (settlementLabel), settledAt, amount, mine }`, newest first.
- `GroupBalances` new inputs: `pendingSettlements`, `settlements` (non-pending settlement rows from the feed), `currency`; outputs `record: CreateSettlementBody-like { fromMemberId, toMemberId, amount }`, `undo: number`. Group page handles them via `FeedStore` with the group id.
- Two `hlm-sheet`s (pattern of `payment-details.html` delete sheet): confirm sheet (line, amount `appFigure`, primary confirm, ghost "Not yet"); undo sheet (line · day label via `dayLabel`, amount, outline destructive "Undo repayment", ghost "Keep it"). Confirm/undo close the sheet first.
- Done section after Repayments / "All settled", hidden when empty; leading `ng-icon lucideCircleCheck` with the owed-green theme class and a thin stroke; my rows have the chevron and are buttons, others muted `li`s.
- `hasPayments` input renamed `hasActivity`.

- [ ] **Step 1: Failing specs**: `balance-rows.spec.ts` — sheet wording for from/to, `pending` matches on from/to/amount, `doneRows` ordering and labels. `group-balances.spec.ts` — chevron/button only on my repayment rows; `pending repayment row is not tappable` and shows "Saving…"; confirm emits `record` with the transfer; Done hidden when empty; Done mine opens the undo sheet and "Undo repayment" emits `undo` with the id; others' Done rows are not buttons.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** frontend tests PASS, `pnpm typecheck`, `pnpm lint`.
- [ ] **Step 5:** Commit `feat(frontend): confirm and undo repayments from the balances tab`.

### Task 7: Repayment details page

**Files:**
- Create: `apps/frontend/src/app/settlement/settlement-details/settlement-details.ts/.html/.spec.ts`
- Modify: `apps/frontend/src/app/app.routes.ts` (`group/:groupId/settlements/:settlementId`, lazy, same guard as payment details)

**Interfaces:**
- Loads via `SettlementApiService.findOne` + members + `AuthService.currentUser()` (as `payment-details.ts` does). States: loading skeleton, not found (404 → `page-state` empty "This repayment was undone"), error with retry.
- Shows `settlementLabel`, amount as the figure, date. "Undo repayment" (outline, destructive text) only when I am from/to; opens the confirm sheet ("Undo this repayment?", "Everyone's balances will be updated.", destructive "Undo repayment", "Cancel"); confirm → `FeedStore.undoSettlement` then navigate back to the group page (`injectGoBack`).

- [ ] **Step 1: Failing spec**: renders label/amount; Undo hidden for a third member; confirm calls `undoSettlement` and navigates; 404 shows the undone state.
- [ ] **Step 2–4:** FAIL → implement → PASS + typecheck.
- [ ] **Step 5:** Commit `feat(frontend): repayment details with undo`.

### Task 8: Playwright scenarios, screenshots, seed, docs

**Files:**
- Create: `apps/e2e/e2e/record-that-i-paid-someone-back.spec.ts`, `record-that-someone-paid-me-back.spec.ts`, `undo-a-repayment-from-the-balances.spec.ts`, `undo-a-repayment-from-its-details.spec.ts`, `a-repayment-between-others-is-read-only.spec.ts`
- Modify: `apps/e2e/screenshots/matrix.ts` (+ fixtures if needed), `apps/backend/scripts/seed-dev.ts` (+ `test/seed-dev.e2e-spec.ts` if it asserts counts)
- Modify: `docs/domain.md`, `docs/design.md`, `docs/roadmap.md`

- [ ] **Step 1:** Scenarios, asserting through roles and text: after confirming, the hero shows "Settled up" (or the remainder), the Repayments row is gone, a Done row and a feed row "You paid Léa back" exist; undo restores the Repayments row; a third member sees no chevron/button and no "Undo repayment" on details.
- [ ] **Step 2:** `pnpm --filter @ardoise/e2e test:e2e` PASS.
- [ ] **Step 3:** Screenshot cells per spec: Balances with tappable rows, row saving, confirm sheet (from, to), Done section, undo sheet from Done, feed with repayment (confirmed, saving), feed with only repayments, details (involved, not involved, loading, not found), details undo sheet, all settled after repayments. Light + dark. Run `pnpm --filter @ardoise/e2e screenshots`.
- [ ] **Step 4:** Seed: a group with a recorded repayment and a remaining debt, a group settled up by repayments, a repayment between two other members. `db:fresh` must succeed (inline `DATABASE_URL` rules as usual).
- [ ] **Step 5:** Docs: `domain.md` Settlement no longer planned, `createdByMemberId`, rule "only from or to may record or undo", net balance formula; `design.md` log picks (B confirm sheet, Done with thin green circle check, undo sheet from Done, "Repayment" wording); `roadmap.md` tick Settlement entries, add **feed pagination** (cursor on `(date, id)`, load more) after Settlement.
- [ ] **Step 6:** `pnpm verify` green. Commit `test(e2e): repayment scenarios and screenshot cells` and `docs: settlement design log, domain rules and roadmap`.

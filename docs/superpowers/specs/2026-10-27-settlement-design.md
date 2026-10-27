# Settlement: record a repayment

The Settlement slice in `docs/roadmap.md`: settlement schema and domain, record and undo use cases, the balance overlay, the unified group feed, and the mark-settled UI.

## Why

The owner's words: "I just want to see the amount and simply confirm the repayment was made." The Balances tab already says who repays whom. This slice lets the two people involved say "done" in a couple of taps, and lets them take it back if they got it wrong.

## Goals

- Confirming a repayment that involves me takes **2 taps** from the Balances tab: the repayment row, then the confirm button.
- After confirmation, balances and repayments reflect it, computed by the server.
- The repayment shows in the group feed at its date and in a Done section of the Balances tab. Either of the two people involved can undo it from the Done row (2 taps) or from its details.
- The feed is a single backend list (payments and repayments together), so pagination can be added later without changing the contract.

## Non-goals

- Partial or free-amount repayments. You confirm the whole suggested transfer.
- Editing a repayment. It can only be undone.
- Approval by the other person, or notifying them.
- Feed pagination. It gets its own roadmap entry right after this slice.
- Real-time updates (SSE slice).
- Recording a repayment between two members you're not one of.

## Anti-goals

- A repayment that changes payments or their shares. It overlays the balance calculation and nothing else (`docs/domain.md`).
- A balance on screen that differs from what the server computed. The client never recomputes balances.
- A repayment that looks like an expense in the feed.

## Domain rules

- **Settlement**: `id, groupId, fromMemberId, toMemberId, amount (cents), settledAt, createdByMemberId`. `from` paid `to` back.
- `amount` is an integer > 0, and `from` ≠ `to`. Both are members of the group.
- **Only `from` or `to` may record or undo a settlement.** The owner decided this. Other members see it but can't act on it. This goes into `docs/domain.md`.
- Record accepts any positive amount between two members; it does not check the amount against the current suggested transfer (my call). The UI only ever offers the transfer amount. If two people confirm the same repayment at the same moment, the balance just goes negative the other way and either can undo, which is acceptable.
- **Net balance** becomes: paid − owed + settled out − settled in. Settled out is the sum of settlements where the member is `from`, settled in where they are `to`. The group's balances still sum to 0. `simplifyDebts` is unchanged: it works on net balances, so a recorded repayment drops out of the suggested transfers on its own.
- Undo is a hard delete, like deleting a payment.
- **A settlement is a pure overlay.** Editing or deleting payments after a repayment is never blocked or flagged. A balance may flip direction afterwards; the suggested transfers follow. `payment` knows nothing about `settlement`.
- `settledAt` is the server time of recording (my call: no date picker, the owner wants it simple).

## Screens

Canvas 393×852, tap targets ≥ 44px. Brainstorm mockups in `.superpowers/brainstorm/` (not committed). In code the concept is `settlement`. On screen it's "repayment".

### Balances tab, Repayments section (picked: B, row opens a sheet)

- Rows where I am `from` or `to` get a trailing chevron › after the amount and are tappable. Other rows stay as they are: muted, read-only, no chevron.
- Tapping opens a bottom sheet (helm `sheet`, as `create-group-sheet` uses):
  - A line: "You pay Léa" or "Tom pays you".
  - The amount, large (`appFigure`).
  - A primary button: "I paid Léa back" when I'm `from`, "Tom paid me back" when I'm `to`.
  - "Not yet" closes the sheet.
- Confirm, optimistic like the rest of the app (`docs/design.md`, "Feels instant"): the sheet closes at once and you stay on the Balances tab. The confirmed repayment row shows "Saving…" in place of its chevron and is no longer tappable, so it can't be recorded twice (my call). The repayment also appears in the feed as "Saving…". The balances keep their previous values until the server confirms, then they're refetched, and the hero and the Balances tab update (server is the authority, as in Balances).
- If the server refuses: the feed row goes away, the Balances row becomes tappable again, and a toast says the repayment wasn't recorded.

### Balances tab, Done section (the owner asked for it)

The owner wanted undo reachable from the repayments list, not only through the feed.

- Under **Repayments**, a **Done** section lists the recorded repayments of the group, newest first (all of them, mine and others', my call, consistent with the Repayments section above it). Hidden when there are none.
- Row: a green check in a thin circle, no fill (lucide `circle-check`, thin stroke, the theme's "owed" green; picked by the owner over a filled pastille), then "You paid Léa back" / "Tom paid you back" / "Inès paid Max back" with the date as a sub-line, and the amount trailing.
- My rows (I am `from` or `to`) are in ink with a chevron and open the **undo sheet**. Others' rows are muted, read only, no chevron.
- Undo sheet: the line and date ("You paid Léa back · Today"), the amount large (`appFigure`), **Undo repayment** (outline, destructive text) and **Keep it**. The sheet is the confirmation: 2 taps, no second step.
- Undo is optimistic like elsewhere: the row leaves Done, the matching feed row disappears, balances are refetched once the server confirms. If refused, both come back and a toast says so.
- The Done rows come from the feed's settlement items, so no extra endpoint.

### Empty states with repayments (my call)

- "Nothing to settle yet" (Balances tab) and the hidden hero balance now mean **the feed is empty** (no payments and no repayments), not "no payments". Once repayments exist, balances show even if every payment was deleted, because the server may say someone owes money.
- The Payments tab shows its empty state only when the feed is empty. A feed holding only repayments lists them.

### Feed (Payments tab)

- Repayments sit in the same feed as payments, at their date, newest first, under the existing day headers.
- Row: "You paid Léa back" / "Tom paid you back" / "Tom paid Léa back", the amount trailing in ink, a small "Repayment" marker so it doesn't read as an expense, and the chevron. The exact form of the marker is left to the builder, within `docs/design.md` (no colour beyond the theme, text directives only).
- Pending: "Saving…" like a pending payment, not tappable.

### Repayment details

- Route `group/:groupId/settlements/:settlementId`.
- Content: the line ("You paid Léa back"), the amount as the screen's figure, the date.
- **Undo repayment** (outline, destructive text), shown only when I am `from` or `to`. Text only, like the payment details buttons.
- Undo opens a confirmation sheet: "Undo this repayment?", "Everyone's balances will be updated.", a destructive **Undo repayment** button and **Cancel**. On confirm, back to the group page, optimistic: the feed row disappears, and balances are refetched after the server confirms. If the server refuses, the row comes back and a toast says so.
- States: loading skeleton, not found (undone meanwhile), error with retry.

## Backend

### `settlement/` context (new)

Repayments have their own rules (only the two people involved, no edit), so they're their own bounded context, not a kind of payment.

- **`domain/`**
  - `settlement.ts`: the entity, plus the invariants (`amount > 0`, `from ≠ to`) and the rule "the actor is `from` or `to`" as pure functions. These are business rules, so they live here, not in the use case.
  - `settlement-repository.ts`: the port and its token `SETTLEMENT_REPOSITORY` (`create`, `findById`, `delete`).
  - Domain errors: `NotInvolvedInSettlement`, `InvalidSettlement`, `SettlementNotFound`.
- **`application/`**: each use case writes one table, so no unit of work. They inject the repository tokens.
  - `RecordSettlementUseCase`: checks the caller is a member, `from` and `to` are members of the group, the caller is one of them; builds the entity; saves.
  - `UndoSettlementUseCase`: loads the settlement, checks the caller is `from` or `to`, deletes.
  - `GetSettlementUseCase`: membership check, returns one settlement for the details screen.
- **`infrastructure/`**: controller, module, `settlement-repository.drizzle.ts`, mapper. Errors map to HTTP in `src/shared/http/` (not involved → 403, not found → 404, invalid → 400).

### `balance/` (extended)

- `net-balances.ts` takes per-member `settledOut` and `settledIn` totals alongside `paid` and `owed`. Its sum-to-zero check covers them. The formula is the domain's to define, so it changes there, not in SQL.
- `balance-repository.drizzle.ts` adds the two settlement sums per member to its aggregates, for both `GET /expense-groups/:groupId/balances` and `GET /balances/mine`.

### `feed/` context (new, read only)

The feed is neither a payment nor a settlement: it's a view that brings both together for display, a read model. So it gets its own small context, and `payment` and `settlement` stay unaware of each other.

- **`domain/`**: the `FeedItem` type (a union on `kind`) and the port `FEED_REPOSITORY`. No business rules.
- **`application/`**: `ListGroupFeedUseCase`, membership check then read.
- **`infrastructure/`**: the Drizzle adapter reads both tables (`UNION ALL`, or two queries merged; builder's choice) ordered by date desc then id desc, so a `(date, id)` cursor can be added later.

### Schema and contracts

- `schema.ts`: table `settlement` (`group_id`, `from_member_id`, `to_member_id` FK to `member`, `created_by_member_id`, `amount` integer, `settled_at`, `created_at`), a `check (amount > 0)` and a `check (from_member_id <> to_member_id)`. Then `db:generate`.
- `@ardoise/shared`:
  - `settlementApi`:
    - `POST /settlements` with `{ groupId, fromMemberId, toMemberId, amount }` → the settlement.
    - `GET /settlements/:id` → the settlement.
    - `DELETE /settlements/:id` → 204.
  - `feedApi.listByGroup`: `GET /expense-groups/:groupId/feed` → `FeedItem[]`, a discriminated union: `{ kind: 'payment', payment }` or `{ kind: 'settlement', settlement }`.
- The feed replaces the group payment list as the source of the Payments tab. If nothing else uses `GET /expense-groups/:groupId/payments` after that, remove it along with its use case (builder checks).

## Frontend placement

- `src/app/settlement/`: `SettlementApiService`, the confirm sheet, the details page.
- The feed store: today's `PaymentStore` holds the feed with optimistic payment creates, edits and deletes. It reads from `feedApi` and gains optimistic settlement record and undo, or the feed state moves to a `FeedStore` that both payments and settlements use. Builder's choice. The "no payments yet" checks (`hasPayments` on the group page, the Balances tab empty state) become "feed is empty", as above.
- Balances refetch after a settlement is confirmed or undone, the same way they do after a payment mutation today.
- A repayment feed row is most likely a `list-row` variant. If it needs a new building block in `shared/ui`, it's called out in the PR.

## Testing

- **Unit** (pure domain): settlement invariants and the involvement rule; `netBalances` with settlements (sum to zero, a settlement cancelling a debt exactly, a settlement overshooting it); `simplifyDebts` fed with settled balances.
- **Backend e2e** (`test/`, testcontainers): record as `from`, as `to`, refused for a third member (403), a non-member (403), `from = to` or amount ≤ 0 (400), a member of another group (400); undo by `from`, by `to`, refused for a third member, 404 after undo; balances and transfers after a settlement; `/balances/mine` after a settlement; feed ordering mixing both kinds, 403 for a non-member.
- **Frontend unit** next to components: chevron only on my rows (Repayments and Done), Done ordering and hidden when empty, sheet wording for `from` and `to`, feed row wording per point of view, Undo shown only to the two involved.
- **Playwright** (`apps/e2e/e2e/`), named as use cases: *record that I paid someone back*, *record that someone paid me back*, *undo a repayment from the balances*, *undo a repayment from its details*, *a repayment between others is read only*.
- **Screenshot matrix**: Balances tab with tappable rows, Balances tab with a row saving, a feed holding only repayments, confirm sheet (as `from`, as `to`), feed with a repayment (confirmed and saving), repayment details (involved, not involved, loading, not found), undo confirm sheet, Done section (mine and others'), undo sheet from Done, Balances tab all settled after repayments. Light and dark.
- **Seed** (`apps/backend/scripts/seed-dev.ts`): a group with a repayment already recorded, a group settled up by repayments, and one with a repayment between two other members.

## Docs

- `docs/domain.md`: Settlement leaves "planned", gains `createdByMemberId`, and the rule "only `from` or `to` may record or undo a settlement" goes into the business rules. The net balance formula includes settlements.
- `docs/design.md`: log the picks (B, row opens a confirm sheet; Done section with a thin green circle check; undo sheet from Done) and the "Repayment" wording.
- `docs/roadmap.md`: tick the Settlement entries; add **feed pagination** (cursor on `(date, id)`, load more) right after.

## Left to the builder

- The look of the "Repayment" marker in the feed.
- One feed store or `PaymentStore` extended.
- `UNION ALL` or two merged queries in the feed adapter.
- Repository method names, and whether the record endpoint returns the settlement or 201 with it.

# Balances: what I owe, who repays whom

The Balances + debt simplification slice in `docs/roadmap.md`: net balance and debt simplification (pure domain), the balance endpoints, and the views on the group page and the home rows.

## Why

The owner's words: "I want to see straight away how much I owe." Most of the time that figure is all they need, next to what they already do most: adding and checking payments. The balance is a landmark that sits beside the feed, not a destination that competes with it.

The full picture of who repays whom is still wanted, as "an elegant screen presenting the repayments left to make". It sits one tap away, and it's meant to be browsed at leisure: "we're outside the quick workflow here, it's the nicest to scan."

## Goals

- My balance in a group is visible with **0 taps** from opening the app (it opens on the last group), and on every group row of home.
- Who repays whom, with the fewest transfers, is **1 tap** from the group page.
- Every member's balance is readable at a glance, as ink bars.
- Amounts are exact to the cent, and balances always add up to zero.

## Non-goals

- Recording a repayment ("I paid Léa back"). That is the Settlement slice, which overlays these balances.
- An overall balance on home summing all groups. The owner decided against it: "little interest", and groups can have different currencies.
- Real-time updates from other members (SSE slice).
- Pairwise history ("what did Léa pay for me"), reminders, payment links (IBAN, Lydia).
- Currency conversion.

## Anti-goals

- The balance crowding out the feed. The figure stays small: the owner rejected versions where it took too much space.
- Colour on the bars. Money colour stays a small green/red dot next to an ink amount (`docs/design.md`).
- A balance shown on screen that differs from what the server computed.

## Domain rules

Already in `docs/domain.md`, restated for precision:

- **Net balance** of a member = sum of `fullAmount` of the payments they paid − sum of their `PaymentShare.amount`. Positive: the group owes them (creditor). Negative: they owe (debtor). Integer cents.
- The balances of a group always sum to 0, because shares sum to `fullAmount`. The domain asserts it.
- **Debt simplification**, greedy: the largest debtor repays the largest creditor the smaller of the two amounts, then repeat until everyone is at zero. Ties broken by lowest member id, so the result is deterministic (my call).
- Every member of the group appears, including members with no payments (balance 0).

## Screens

Canvas 393×852, tap targets ≥ 44px. Brainstorm mockups in `.superpowers/brainstorm/` (not committed).

### Group page hero (picked: C5, balance right-aligned)

- Unchanged top: backdrop, ‹ and ⋯, group name, member names.
- **Below the member names, right-aligned**: a small eyebrow label over the amount, white over the backdrop.
  - I owe: "You owe" + red dot + `€42.50` (unsigned, the label carries the direction).
  - I'm owed: "Owed to you" + green dot + `€18.30`.
  - Zero: "Settled up" + `€0.00`, no dot.
  - No payments in the group yet: the balance block is hidden (my call: "Settled up" on a brand-new group reads oddly).
- The figure is modest, about the size of a section title, not a hero-size figure. The owner liked the Z reading this creates: name top-left, amount bottom-right.
- Tapping the balance switches to the Balances tab (my call).
- Loading: a skeleton where the amount goes. Error: the balance block is hidden; the Balances tab carries the error and retry.
- `docs/design.md` says "one main figure per screen"; here the hero stays the group's identity and the balance is its secondary line, which is the point of C5.

### Tabs (picked: C, Payments / Balances)

- A two-option segmented control right under the hero: **Payments** (default) and **Balances**.
- The selected tab is in the URL (`?tab=balances`), replacing the history entry, so a reload keeps it and back still goes home (my call).
- The FAB + stays on both tabs.

### Balances tab (picked: T3, every member's balance, then repayments)

Top to bottom:

1. **Balances** section header, then one hairline row per member: name ("You" for me), an ink bar, and the signed amount with its dot (the existing `balance-indicator`).
   - The bar sits on a centre axis: to the left when the member owes, to the right when they're owed. Its length is proportional to the largest absolute balance in the group.
   - Ink only: owing is the stronger ink, owed the lighter one (as in the mockup). Exact tokens left to the builder within the design system.
   - Sorted from most owed to most owing, then by name. My row is lightly highlighted (my call).
2. **Repayments** section header, then one row per transfer: "You pay Léa · €30.00", "Tom pays you · €12.00", "Tom pays Léa · €58.20".
   - Transfers involving me first, in ink; the others after, in muted foreground (my call). Within each group, largest amount first.

States:

- **Loading**: skeleton rows.
- **Error**: `page-state` error with retry.
- **No payments yet**: told apart from "all settled" by the payment feed the group page already loads (`PaymentStore`), not by the balance contract (my call). No bars; an empty state "Nothing to settle yet", with a quieter line pointing to +.
- **All settled** (payments exist, every balance is 0): the member rows show `€0.00` with empty bars, and the Repayments section is replaced by a calm "All settled" line.

### Home group rows

- The reserved trailing slot (`data-testid="balance-slot"`) shows my balance in that group with the `balance-indicator` (dot + signed amount), white over the group's fade as `docs/design.md` already says.
- Zero: nothing shown (my call: settled groups stay quiet).
- While balances load or if they fail, the slot stays empty; the group list itself never waits on balances (my call).

### Freshness

- Balances load when the group page or home opens.
- After a payment add, edit or delete is confirmed by the server, the group's balances are refetched. While a payment is still "Saving…", the balance shows the previous value (my call: the server stays the authority, no client-side recompute).

## Backend

A new bounded context `balance/`, because balances are their own concept: a read model computed from payments and shares, which Settlement will later overlay. Placement, and why:

- **`balance/domain/`**
  - `net-balances.ts`: from per-member totals (`paid`, `owed`) to per-member net balance, asserting the sum is 0. Pure.
  - `simplify-debts.ts`: from net balances to transfers `{ fromMemberId, toMemberId, amount }`, greedy as above. Pure.
  - `balance-repository.ts`: the port and its DI token (`BALANCE_REPOSITORY`). It returns per-member totals for a group, and my totals across all my groups. The domain decides what a balance *is*; how the sums are read is the adapter's business.
  - These are domain functions, not a domain service class: no state, no collaborators.
- **`balance/application/`**, read-only, so no unit of work; the use cases inject the repository tokens directly:
  - `GetGroupBalancesUseCase`: checks the caller is a member of the group (`NotAMember`, like `ListGroupPaymentsUseCase`), loads the totals, runs `netBalances` then `simplifyDebts`, returns both.
  - `ListMyBalancesUseCase`: my net balance in each group I belong to.
- **`balance/infrastructure/`**: controller, module, `balance-repository.drizzle.ts`. The per-member sums are SQL aggregates (`SUM` over `payment` and `payment_share`, grouped by member, left-joined from `member` so zero-balance members are included). Aggregating in SQL is a persistence choice, so it stays in the adapter.
- **Contracts** (`@ardoise/shared`, `balanceApi`):
  - `GET /groups/:groupId/balances` → `{ balances: { memberId, amount }[], transfers: { fromMemberId, toMemberId, amount }[] }`. Amounts in integer cents. Non-member → 403.
  - `GET /balances/mine` → `{ groupId, amount }[]`, one entry per group I belong to.
  - A separate endpoint rather than a field on the group list (my call): it keeps `expense-group` unaware of balances, and home renders its rows without waiting.
- No schema change, no migration.

## Frontend placement

- `src/app/balance/`: `BalanceApiService`, and the Balances tab content as a component the group page hosts.
- The group page gains the segmented control (helm `toggle-group`, or a new `segmented-control` block in `shared/ui` if it doesn't fit) and the hero balance.
- **New building block** `shared/ui/balance-bar`: the centred ink bar for one member. Called out in the PR.
- The hero balance is probably a small addition to `group-hero` (a content slot), or a block of its own; builder's choice.
- Home: `balance-indicator` in the existing trailing slot, fed by `GET /balances/mine`.
- `docs/design.md`: log the picks (C5 hero balance right-aligned, tabs, T3 balances tab) and the "Settled up" wording, and drop "the home overall balance" from the violet line (now a non-goal).

## Testing

- **Unit** (pure domain, `balance/domain/*.spec.ts`): `netBalances` (sum assertion, members with nothing), `simplifyDebts` (one debtor many creditors, many to many, already settled, ties broken by member id, transfer count ≤ members − 1, the transfers settle every balance exactly).
- **Backend e2e** (`test/`, testcontainers): group balances for a member, 403 for a non-member, a member with no payments at 0, a payer excluded from their own split; `/balances/mine` across several groups including one with no payments.
- **Frontend unit** next to components: hero label per sign, tab switch and `?tab`, bar proportions, repayment ordering and wording, home slot hidden at 0.
- **Playwright** (`apps/e2e/e2e/`), named as use cases: *see what I owe in a group*, *see who repays whom*, *see my balance on the group list*, *balance updates after adding a payment*.
- **Screenshot matrix**: group page hero (I owe, I'm owed, settled up, no payments, loading), Balances tab (filled, all settled, no payments, loading, error), home filled with balances. Light and dark.
- **Seed** (`apps/backend/scripts/seed-dev.ts`): groups showing each state: I owe, I'm owed, all settled, no payments.

## Left to the builder

- Exact tokens for the two bar inks, bar thickness and row spacing, within `docs/design.md`.
- Whether the hero balance is a `group-hero` slot or a separate block.
- Segmented control: helm `toggle-group` or a new block.
- Repository method names and the SQL shape, as long as zero-balance members are included.

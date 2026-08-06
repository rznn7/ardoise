# Ardoise — Roadmap

Build by vertical slice, value-first order.

> **Each bullet = one `td-design` run.** Scopes are deliberately narrow: one focused
> design doc → red/green cycle → ship. This keeps each slice reviewable and the code
> quality high. Don't merge bullets — split further if one grows.

## Phase 1 — Group lifecycle (close the loop)
Without a join flow the app is unusable.
- [x] **invite-link consume (backend)** — one use-case covering both paths: register-new
  (already wires `inviteToken`) and join-existing-user. Creates the `Member`, marks the
  link consumed, single transaction.
- [x] **group/member read endpoints (backend)** — `expense-group` list-mine and `member`
  list-by-group, with their contracts and guards.
- [x] **mobile shell (frontend)** — `MobileShell` layout reused by all screens: `100dvh`,
  `env(safe-area-inset-*)` padding, centered `max-w-[420px]` column, sticky header slot, FAB
  slot, optional bottom-tab slot (unused at root). Adds slate `--primary`/`--ring` and
  `--balance-positive/negative` tokens. Target canvas 393×852.
- [x] **multi-use invite consume (backend)** — make the `singleUse` flag functional: a
  multi-use link admits many users until `expiresAt` (relying on the existing already-member
  idempotency), while single-use links still burn after first consume. Folds in a rename of the
  spent-marker columns `consumed*` → `burned*` (+ migration) to resolve the consume-action /
  consumed-column collision. Closes the documented gap in `001-invite-link-consume-backend.md`
  non-goals. See `design-docs/004-multi-use-invite-consume-backend.md`.
- [x] **group create + list (frontend)** — home: header + group rows (name, member count,
  reserved balance-badge slot) + empty state + FAB → create bottom sheet → flips to
  invite-link copy/share.
- [x] **accept-invite page (frontend)** — landing for an invite token: group-context header,
  passkey-join (new user) or one-tap join (existing user). See
  `design-docs/006-accept-invite-page-frontend.md`.

## Phase 2 — Payments (the heart)
`payment` / `payment-share` already have schema, entities, repositories, mappers and find
use-cases — only the split logic and the create path are missing.
- [ ] **split computation (pure domain)** — compute `PaymentShare.amount` from `splitType`
  + `inputValue` for all 4 types, EQUAL remainder → payer, assert sum == `fullAmount`.
  No DB, fully unit-tested in isolation.
- [ ] **create-payment use-case (backend)** — persist payment + shares in a unit-of-work
  transaction, consuming the split logic above.
- [ ] **payment list (backend)** — list-by-group query, endpoint, contract.
- [ ] **group page (frontend)** — the group-scoped screen everything below hangs off:
  route `/group/:id`, header with group name + member list (consumes the 002 member
  list-by-group endpoint, unused until now), empty payment feed, FAB slot. Makes the home
  group rows navigate here, and adds an invite-link action so a fresh link can be generated
  for an existing group (today only reachable from the create-group sheet's second step).
- [ ] **add-payment form (frontend)** — one form, 4 split types. Lives behind the group-page FAB.
- [ ] **payment list (frontend)** — group payment feed, fills the group page.

## Phase 3 — Balances + debt simplification
Pure domain, no DB — high value, isolated, easy win.
- [ ] **net balance (pure domain)** — net balance per member (paid − owed).
- [ ] **debt simplification (pure domain)** — greedy creditor/debtor matching to minimize
  transaction count.
- [ ] **balance endpoint (backend)** — use-case wiring + contract.
- [ ] **balance view (frontend)** — who-owes-whom display, hosted on the Phase 2 group page.

## Phase 4 — Settlement
A settlement overlays the balance calculation; it never mutates payments.
- [ ] **settlement schema + domain (backend)** — table, entity, repository.
- [ ] **create-settlement use-case + balance overlay (backend)** — endpoint, contract, and
  integration into the balance calc.
- [ ] **mark-settled UI (frontend)** — record a repayment from the balance view.

## Phase 5 — Real-time SSE
- [ ] **SSE stream infra (backend)** — per-group `@Sse` endpoint, connection management,
  event emitter.
- [ ] **domain event wiring (backend)** — push on payment / settlement / member change.
- [ ] **live subscription (frontend)** — EventSource subscription + reactive refresh.

## Phase 6 — Hardening & ship
- [x] **Drizzle migrations** — migration setup and baseline.
- [ ] **deploy** — Docker compose + Hetzner.
- [ ] **multi-device passkey** — lift the v1 single-passkey non-goal.
- [ ] **account recovery** — lift the v1 no-recovery non-goal.

---

## Sequencing
- **Phase 1 is blocking** — join flow required to exercise everything downstream.
- **Phase 3** is standalone (pure domain); can go early for a quick win — but its frontend
  bullet needs the Phase 2 group page.
- Phases 4–5 depend on Phase 2.

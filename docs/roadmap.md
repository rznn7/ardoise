# Ardoise — Roadmap

Build by vertical slice, value-first order.

> **Each bullet = one `td-design` run.** Scopes are deliberately narrow: one focused
> design doc → red/green cycle → ship. This keeps each slice reviewable and the code
> quality high. Don't merge bullets — split further if one grows.

## Phase 1 — Group lifecycle (close the loop)
Without a join flow the app is unusable.
- **invite-link consume (backend)** — one use-case covering both paths: register-new
  (already wires `inviteToken`) and join-existing-user. Creates the `Member`, marks the
  link consumed, single transaction.
- **group/member read endpoints (backend)** — `expense-group` list-mine and `member`
  list-by-group, with their contracts and guards.
- **group create + list (frontend)** — create-group form and the group list on home.
- **accept-invite page (frontend)** — landing for an invite token: register or join.

## Phase 2 — Payments (the heart)
- **split computation (pure domain)** — compute `PaymentShare.amount` from `splitType`
  + `inputValue` for all 4 types, EQUAL remainder → payer, assert sum == `fullAmount`.
  No DB, fully unit-tested in isolation.
- **create-payment use-case (backend)** — persist payment + shares in a unit-of-work
  transaction, consuming the split logic above.
- **payment list (backend)** — list-by-group query, endpoint, contract.
- **add-payment form (frontend)** — one form, 4 split types.
- **payment list (frontend)** — group payment feed.

## Phase 3 — Balances + debt simplification
Pure domain, no DB — high value, isolated, easy win.
- **net balance (pure domain)** — net balance per member (paid − owed).
- **debt simplification (pure domain)** — greedy creditor/debtor matching to minimize
  transaction count.
- **balance endpoint (backend)** — use-case wiring + contract.
- **balance view (frontend)** — who-owes-whom display.

## Phase 4 — Settlement
A settlement overlays the balance calculation; it never mutates payments.
- **settlement schema + domain (backend)** — table, entity, repository.
- **create-settlement use-case + balance overlay (backend)** — endpoint, contract, and
  integration into the balance calc.
- **mark-settled UI (frontend)** — record a repayment from the balance view.

## Phase 5 — Real-time SSE
- **SSE stream infra (backend)** — per-group `@Sse` endpoint, connection management,
  event emitter.
- **domain event wiring (backend)** — push on payment / settlement / member change.
- **live subscription (frontend)** — EventSource subscription + reactive refresh.

## Phase 6 — Hardening & ship
- **Drizzle migrations** — migration setup and baseline.
- **deploy** — Docker compose + Hetzner.
- **multi-device passkey** — lift the v1 single-passkey non-goal.
- **account recovery** — lift the v1 no-recovery non-goal.

---

## Sequencing
- **Phase 1 is blocking** — join flow required to exercise everything downstream.
- **Phase 3** is standalone (pure domain); can go early for a quick win.
- Phases 4–5 depend on Phase 2.

# Ardoise — Roadmap

Build by feature slice, value-first order.

> **Each `##` slice = one spec + one plan + one PR**, covering backend, frontend and tests
> (see Workflow in `design.md`). Sub-items are the scope checklist, not separate runs.

## Group lifecycle (done)
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
  consumed-column collision. Closes the multi-use gap left as a non-goal by the original
  invite-link consume bullet.
- [x] **group create + list (frontend)** — home: header + group rows (name, member count,
  reserved balance-badge slot) + empty state + FAB → create bottom sheet → flips to
  invite-link copy/share.
- [x] **accept-invite page (frontend)** — landing for an invite token: group-context header,
  passkey-join (new user) or one-tap join (existing user).

## Design system foundation
Ink tokens and theme, Figtree, building blocks, backdrops, lint enforcement, screenshot and A/B
tooling, Playwright e2e. Existing screens moved onto it.
See `superpowers/specs/2026-10-25-design-system-and-workflow-design.md`.
- [x] **foundation** — `superpowers/plans/2026-10-25-design-system-foundation.md`.

## Payments (the heart)
- [x] **split computation (pure domain)** — compute `PaymentShare.amount` from `splitType`
  + `inputValue` for all 4 types, largest-remainder rounding (payer-favoring tie-break),
  assert sum == `fullAmount`. No DB, fully unit-tested in isolation.
- [x] **create-payment use-case (backend)** — persist payment + shares in a unit-of-work
  transaction, consuming the split logic above. Folds in an authorization fix for the two
  existing payment read endpoints, which returned any payment to any authenticated user.
- [x] **payment list (backend)** — list-by-group query, endpoint, contract.
- [x] **group page (frontend)** — the group-scoped screen everything below hangs off:
  route `/group/:id`, header with group name + member list (consumes the member
  list-by-group endpoint, unused until now), empty payment feed, FAB slot. Makes the home
  group rows navigate here, and adds an invite-link action so a fresh link can be generated
  for an existing group (today only reachable from the create-group sheet's second step).
- [x] **add-payment form (frontend)** — one form, 4 split types. Lives behind the group-page FAB.
- [x] **payment feed (frontend)** — group payment feed, fills the group page.
- [x] **payment details, edit, delete** — details screen with shares, edit through the same form
  (opens on options), delete with a confirmation sheet. Any member may edit or delete.

## Balances + debt simplification
Pure domain, no DB — high value, isolated, easy win.
- [ ] **net balance (pure domain)** — net balance per member (paid − owed).
- [ ] **debt simplification (pure domain)** — greedy creditor/debtor matching to minimize
  transaction count.
- [ ] **balance endpoint (backend)** — use-case wiring + contract.
- [ ] **balance view (frontend)** — who-owes-whom display, hosted on the group page.

## Settlement
A settlement overlays the balance calculation; it never mutates payments.
- [ ] **settlement schema + domain (backend)** — table, entity, repository.
- [ ] **create-settlement use-case + balance overlay (backend)** — endpoint, contract, and
  integration into the balance calc.
- [ ] **mark-settled UI (frontend)** — record a repayment from the balance view.

## Real-time SSE
- [ ] **SSE stream infra (backend)** — per-group `@Sse` endpoint, connection management,
  event emitter.
- [ ] **domain event wiring (backend)** — push on payment / settlement / member change.
- [ ] **live subscription (frontend)** — EventSource subscription + reactive refresh.

## Personal settings
- [ ] **settings page (frontend)** — personal settings screen; first entry is the theme
  selector (system / light / dark) on top of the existing `ThemeService`.
- [ ] **logout control (frontend)** — the auth flow supports logout; no UI exposes it yet.

## Hardening & ship
- [x] **Drizzle migrations** — migration setup and baseline.
- [x] **preview deploy** — every main push publishes images; deployed by hand on the homelab at ardoise.rznn.dev, demo data reset, accounts kept.
- [ ] **production deploy** — Docker compose + Hetzner.
- [ ] **PWA** — manifest, icons, installability, standalone mode, iOS keyboard handling
  (needed by the add-payment form at the latest).
- [ ] **multi-device passkey** — lift the v1 single-passkey non-goal.
- [ ] **account recovery** — lift the v1 no-recovery non-goal.

---

## Sequencing
- **Design system foundation** comes before any new screen.
- **Balances** domain work is standalone; its view needs the Payments group page.
- Settlement and Real-time depend on Payments.

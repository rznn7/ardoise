# Ardoise — Stack & Domain

## Tech Stack

### Monorepo structure
```
apps/
  frontend/   (Angular)
  backend/    (NestJS)
libs/
  shared/     (shared TypeScript types & DTOs)
```

### Frontend — Angular
- **Auth** : Passkeys (WebAuthn) — registration via single-use invite link, login via browser/OS passkey prompt
- **Real-time** : SSE (native EventSource)
- **Validation** : shared types are sufficient (data comes from our own backend)

### Backend — NestJS
- **Auth** : `@simplewebauthn/server` (WebAuthn) + JWT session in `httpOnly` cookie. No passwords, no third-party OAuth.
- **Validation** : `class-validator` + `class-transformer`
- **Real-time** : SSE
- **ORM** : Drizzle + PostgreSQL
- **Architecture** : Hexagonal (domain / application / infrastructure)

### Infra
- **Hosting** : Hetzner VPS ~€4/month
- **Deployment** : Docker + `docker-compose`
- **DB** : PostgreSQL (native transactions for concurrency)

---

## Domain

### Entities

#### User
```
id, displayName, role (user | admin), createdAt
```
- `role = 'admin'` is the **app-level** admin (platform staff). Distinct from group moderators.
- No password, no email. Identity is proven by passkey possession.

#### Passkey *(WebAuthn credential bound to a User)*
```
id, userId, credentialId (unique), publicKey, counter, createdAt
```
- **v1 scope**: exactly one Passkey per User. Created at registration, never replaced.
- Lost device = lost account. No recovery flow in v1. Multi-device and recovery are explicit non-goals until the basic flow works end-to-end.

#### ExpenseGroup
```
id, name, currencyCode (ISO 4217), createdAt
```

#### Member *(User within an ExpenseGroup)*
```
id, userId, groupId, nickname, isModerator, createdAt
unique(userId, groupId)
```
- `isModerator` is the **group-level** role. Renamed from `isAdmin` to avoid conflict with `User.role`.

#### Payment *(an expense)*
```
id, groupId, payerMemberId, title, fullAmount (cents), paidAt, splitType (EQUAL | PERCENT | SHARES | EXACT), createdAt
```

#### PaymentShare *(each member's share of a payment)*
```
paymentId, memberId, inputValue, amount (cents)
primaryKey(paymentId, memberId)
```

- `inputValue` = raw user intent, interpreted by `splitType`
  - EQUAL → ignored
  - PERCENT → basis points (5000 = 50%)
  - SHARES → weight
  - EXACT → cents
- `amount` = computed final cents, frozen at save. Sum across shares == `Payment.fullAmount`.

#### Settlement *(debt repayment — planned)*
```
id, groupId, fromMemberId, toMemberId, amount (cents), settledAt
```

#### InviteLink *(planned)*
```
id, groupId, token (256-bit random, base64url), singleUse, consumedByUserId (nullable), consumedAt (nullable), expiresAt (configurable, default 7d), createdAt
```
- A link grants the right to **either** register a new User (passkey + first membership) **or** join the group as an already-existing User.
- `singleUse = true` for member invites; consumed on first successful join/registration.

---

### Business rules

- The sum of all `PaymentShare.amount` values must always equal `Payment.fullAmount`
- Money stored as integer cents everywhere. No floats.
- For `EQUAL` splits: amount divided evenly — rounding remainder goes to the payer
- On payment edit: recompute `PaymentShare.amount` from `splitType` + `inputValue` against new total
- The payer is excluded from their own debt calculation
- A `Settlement` does not modify payments — it overlays the balance calculation
- Only a moderator (`Member.isModerator = true`) can configure the group (currency, invite duration, removing members)
- The group creator automatically becomes a moderator
- Any member can add a payment

---

### Debt simplification algorithm

Rather than displaying all raw debts (A→B, B→C, A→C...), we minimize the number of transactions:

1. Compute each member's net balance `(amount paid - amount owed)`
2. Split into creditors `(balance > 0)` and debtors `(balance < 0)`
3. Greedy match: the largest debtor repays the largest creditor, until zero

> This algorithm lives entirely in the domain layer with no DB dependency — a perfect use case for hexagonal architecture.

---

### Features

- Group creation with a fixed currency
- Invitation via shareable link (configurable expiry)
- Add payments with equal, exact, percentage, or share-based splits
- Simplified balance view
- Mark a debt as settled (Settlement)
- Real-time updates via SSE for all connected members
- Passkey authentication (no password, no third-party identity provider) — v1: one passkey per user, no multi-device, no recovery

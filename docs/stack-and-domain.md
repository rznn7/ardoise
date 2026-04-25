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
- **Auth** : Google OAuth (redirect to backend)
- **Real-time** : SSE (native EventSource)
- **Validation** : shared types are sufficient (data comes from our own backend)

### Backend — NestJS
- **Auth** : Passport.js + Google OAuth + JWT in `httpOnly` cookie
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
id, googleId, email, name, avatarUrl, role, createdAt
```

#### ExpenseGroup
```
id, name, currencyCode (ISO 4217), createdAt
```

#### Member *(User within an ExpenseGroup)*
```
id, userId, groupId, nickname, isAdmin, createdAt
unique(userId, groupId)
```

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
id, groupId, token (uuid), expiresAt (configurable, default 7d), createdAt
```

---

### Business rules

- The sum of all `PaymentShare.amount` values must always equal `Payment.fullAmount`
- Money stored as integer cents everywhere. No floats.
- For `EQUAL` splits: amount divided evenly — rounding remainder goes to the payer
- On payment edit: recompute `PaymentShare.amount` from `splitType` + `inputValue` against new total
- The payer is excluded from their own debt calculation
- A `Settlement` does not modify payments — it overlays the balance calculation
- Only an admin (`Member.isAdmin = true`) can configure the group (currency, invite duration, removing members)
- The group creator automatically becomes admin
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
- Google OAuth (no password)

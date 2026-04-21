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
- **ORM** : Prisma + PostgreSQL
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
id, googleId, email, name, avatarUrl, createdAt
```

#### Group
```
id, name, currency, createdAt
```

#### Member *(User within a Group)*
```
id, userId, groupId, role (ADMIN | MEMBER), joinedAt
```

#### Expense
```
id, groupId, payerId, title, amount, splitType (EQUAL | FIXED | PERCENT), date, createdAt
```

#### ExpenseSplit *(each member's share of an expense)*
```
id, expenseId, memberId, amount
```

#### Settlement *(debt repayment)*
```
id, groupId, fromMemberId, toMemberId, amount, settledAt
```

#### InviteLink
```
id, groupId, token (uuid), expiresAt (configurable, default 7d), createdAt
```

---

### Business rules

- The sum of all `ExpenseSplit` amounts must always equal the `Expense` amount
- For `EQUAL` splits: amount is divided evenly — rounding remainder goes to the payer
- The payer is excluded from their own debt calculation
- A `Settlement` does not modify expenses — it overlays the balance calculation
- Only an ADMIN can configure the group (currency, invite duration, removing members)
- The group creator automatically becomes ADMIN
- Any member can add an expense

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
- Add expenses with equal, fixed, or percentage splits
- Simplified balance view
- Mark a debt as settled (Settlement)
- Real-time updates via SSE for all connected members
- Google OAuth (no password)

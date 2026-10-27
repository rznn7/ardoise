# Ardoise — Domain

## Entities

### User
```
id, name, role (user | admin), webauthnUserId (unique), createdAt
```
- `role = 'admin'` is the **app-level** admin (platform staff). Distinct from group moderators.
- No password, no email. Identity is proven by passkey possession.

### Passkey *(WebAuthn credential bound to a User)*
```
id, userId, credentialId (unique), publicKey, counter, lastUsedAt, createdAt
```
- **v1 scope**: exactly one Passkey per User. Created at registration, never replaced.
- Lost device = lost account. No recovery flow in v1. Multi-device and recovery are explicit non-goals until the basic flow works end-to-end.

### Session
```
token (PK), id (unique), userId, issuedAt, expiresAt, revokedAt (nullable)
```
- `id` lets the admin API reference a session; the token never leaves the server.
- Issued on registration or login, sent as the `httpOnly` session cookie. Logout revokes it.

### RegistrationState / LoginState *(WebAuthn ceremony state)*
```
stateId (unique), challenge, expiresAt          + webauthnUserId, inviteToken for registration
```
- Short-lived (10 min) server-side challenge storage between the begin and complete steps.

### ExpenseGroup
```
id, name, currencyCode (ISO 4217), createdAt
```

### Member *(User within an ExpenseGroup)*
```
id, userId, groupId, nickname (nullable), isModerator, createdAt
unique(userId, groupId)
```
- `isModerator` is the **group-level** role. Named to avoid conflict with `User.role`.

### InviteLink
```
id, groupId, token (unique), singleUse, burnedByUserId (nullable), burnedAt (nullable), revokedAt (nullable), expiresAt, createdAt
```
- Status, in this order: `revoked` if `revokedAt` is set, `used` if single use and burned, `expired` past `expiresAt`, else `active`.
- A revoked link is refused like an expired one (preview, consume, registration).
- A link grants the right to **either** register a new User (passkey + first membership) **or** join the group as an already-existing User.
- `singleUse = true`: burned on first successful join/registration.
- `singleUse = false`: admits any number of users until `expiresAt`. Joining a group you already belong to is idempotent.

### Payment *(an expense)*
```
id, groupId, payerMemberId, title, fullAmount (cents), paidAt, splitType (equal | percent | shares | exact), createdAt
```

### PaymentShare *(each member's share of a payment)*
```
paymentId, memberId, inputValue, amount (cents)
primaryKey(paymentId, memberId)
```

- `inputValue` = raw user intent, interpreted by `splitType`
  - equal → ignored
  - percent → basis points (5000 = 50%)
  - shares → weight
  - exact → cents
- `amount` = computed final cents, frozen at save. Sum across shares == `Payment.fullAmount`.

### Settlement *(debt repayment)*
```
id, groupId, fromMemberId, toMemberId, amount (cents), settledAt, createdByMemberId
```

- `from` paid `to` back. `amount > 0`, `from ≠ to`, both members of the group.
- `settledAt` is the server time of recording. Undo is a hard delete; a settlement is never edited.

---

## Business rules

- The sum of all `PaymentShare.amount` values must always equal `Payment.fullAmount`
- Money stored as integer cents everywhere. No floats.
- Rounding (`equal` / `percent` / `shares`): each share is floored, then the leftover cents (at
  most `participants − 1`) are distributed one each by largest fractional remainder, tie-broken
  in favor of the payer, then by lowest `memberId`. No member ever absorbs more than one extra
  cent. `exact` never rounds. Implemented in `libs/shared/src/split/apportion.ts`.
- On payment edit: recompute `PaymentShare.amount` from `splitType` + `inputValue` against new total
- The payer is excluded from their own debt calculation
- A `Settlement` does not modify payments — it overlays the balance calculation. Editing or deleting payments afterwards is never blocked; a balance may flip direction.
- Only `fromMemberId` or `toMemberId` may record or undo a settlement. Any member of the group can see it.
- Only a moderator (`Member.isModerator = true`) can configure the group (currency, invite duration, removing members)
- The group creator automatically becomes a moderator
- Any member can add a payment
- Any member can edit or delete a payment
- Only an app admin (`User.role = 'admin'`) can read the admin overview, revoke an invite link or revoke a session through it. An admin can't revoke their own current session.

---

## Debt simplification algorithm

Rather than displaying all raw debts (A→B, B→C, A→C...), we minimize the number of transactions:

1. Compute each member's net balance `(amount paid - amount owed + settled out - settled in)`
2. Split into creditors `(balance > 0)` and debtors `(balance < 0)`
3. Greedy match: the largest debtor repays the largest creditor, until zero
4. Ties go to the lowest member id, so the result is deterministic

> This algorithm lives entirely in the domain layer with no DB dependency — a perfect use case for hexagonal architecture.

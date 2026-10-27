# Admin overview: who is on the instance, and where

The first piece of an admin panel for the app-level admin (`User.role = 'admin'`). It's read-only, apart from one action: revoking invite links. It isn't on the roadmap yet; this slice adds it.

## Why

The owner's words: "we should start with an overview, without necessarily any actions, that's what is missing today. Just visibility on who is registered in the app, which group they belong to, etc." Today the only way to know who joined the instance is to open the database.

The panel is also the place where instance settings and admin actions will land in later slices ("so we can add settings to it as development goes on"). Account management (create, edit, delete) and richer invite links (number of uses, validity) were discussed and deferred: the owner wants the overview first.

## Goals

- An admin sees, from home, in **1 tap**: how many users, groups and payments the instance has, and the list of users and of groups.
- **1 more tap** on a user shows their groups (with role and balance) and their account info. On a group, it shows its members (with role and balance) and its invite links.
- An admin can **revoke** an invite link that is still valid, so nobody can join with it any more.
- An admin can **revoke** a user's active session, which signs that device out (lost or handed-over phone).
- The screens are made of sections, so later slices can add sections (settings, actions) without reworking them.
- Nobody who isn't an admin can see the panel or reach its endpoints.

## Non-goals

- Creating, editing or deleting accounts. Passkey-only accounts mean an admin can't create one for someone; that will go through invite links in a later slice.
- Richer invite links (a number of uses, admin links not tied to a group). The current `singleUse` / `expiresAt` model stays.
- Instance settings (registration mode, default currency, limits…). The panel is built to receive them later.
- Promoting or demoting admins from the UI. See "Becoming admin" below.
- Passkey management (delete, re-create for a user, several passkeys per user), for the admin and for the user. Planned later; the roadmap gets the entries.
- Search, filters or pagination of the lists (instances are small).
- Audit log of admin actions.

## Anti-goals

- A non-admin seeing any of it, or guessing it exists: no entry button, and 403 on every endpoint.
- Mixing up the two roles. `User.role` is the app admin, `Member.isModerator` the group role (`CLAUDE.md`). The admin doesn't become a member of the groups they inspect.
- A revoked link that still lets someone join.

## Domain rules

- **Only a user with `role = 'admin'` may read the admin overview, revoke an invite link or revoke a session through it.**
- **Revoking** an invite link sets `revokedAt` (new nullable column on `invite_link`). A revoked link behaves like an expired one: preview and consume refuse it with the same response the invite page already handles for an expired link (my call: the person joining doesn't need to know why). Revoking an already revoked, expired or used link is a no-op (204).
- **Invite link status**, derived, in this order: `revoked` if `revokedAt` is set, `used` if single use and burned, `expired` if `expiresAt` is past, else `active`.
- **Revoking a session** sets its `revokedAt` (the existing `Session.revoke`, as logout does). Revoking an already revoked or expired session is a no-op (204). The admin's **current** session is never offered for revocation (my call: it would sign them out mid-action); the API refuses it with 400 `CANNOT_REVOKE_CURRENT_SESSION`.
- **Last sign-in** of a user = the latest `session.issuedAt` (my call: the closest thing to "last seen" we store; shown as "signed in 2 days ago"). Users with no session show their join date.
- Balances shown here are the same server-computed balances as the Balances slice (`balance` domain). The admin sees amounts: the owner approved the mockups that show them.

## Becoming admin

There is no UI to grant the role in this slice. The owner picked the simplest option, to be reworked later with real configuration steps:

- The demo seed makes its **primary account** an admin: the oldest real account it keeps (lowest id with a passkey), or Alice when there is none. This applies everywhere the seed runs, the preview included, since the preview container runs `db:seed` on every boot.
- Consequence, accepted: on the preview, the oldest registered account is the admin.
- No `admin:grant` script for now (prod isn't deployed). The roadmap gets an entry for a proper admin bootstrap.

## Screens

Canvas 393×852, tap targets ≥ 44px. Mockups in `.superpowers/brainstorm/admin/` (not committed).

### Entry (home)

- An icon button at the top right of home, beside the "Groups" title, **only when `me.role === 'admin'`** (lucide `shield`, ghost, round like the group page's ⋯). `aria-label="Admin"`. It opens `/admin`.

### Admin overview, `/admin`

- Back button ‹ (to home).
- Title "Admin", and a meta line with the instance host (`location.host`).
- Three figures in a row: **Users**, **Groups**, **Payments** (counts).
- Segmented control **Users / Groups**, held in `?tab=groups` with `replaceUrl`, like the group page tabs.
- **Users** tab: one row per user, sorted by name. Title: the name, plus an "Admin" marker for admins. Meta: "4 groups · signed in today", or "No group · joined yesterday". A chevron. Tap opens the user.
- **Groups** tab: one row per group, sorted by name. Meta: "5 members · 31 payments · EUR". A chevron. Tap opens the group.
- States: loading skeleton, error with retry. No empty state: the admin is always a user.

### User detail, `/admin/users/:userId`

- Back ‹. Title: the name (with the "Admin" marker if admin). Meta: "Joined 12 Oct · signed in 2 days ago · 1 passkey".
- **Groups** section: one row per membership, sorted by group name. Title: group name. Meta: "Moderator · 2 members" or "Member · 5 members". Trailing: the user's balance in that group with the `balance-indicator` (dot + signed amount, `€0.00` with no dot). Tap opens the admin group detail.
- **Sessions** section: active sessions (not revoked, not expired), newest first, "Signed in 27 Oct · expires in 26 days". "No active session" when none.
  - Each session except the one the admin is using has a trailing **Revoke** text button (destructive text). The admin's own current session shows "This device" instead.
  - **Revoke** opens a confirmation sheet: "Sign this session out?", "This device will need the passkey to sign in again.", a destructive **Revoke** and **Cancel**. Optimistic: the row disappears at once; if the server refuses, it comes back with a toast "Couldn't revoke the session".
- States: loading, not found (404), error with retry.

### Group detail, `/admin/groups/:groupId`

- Back ‹. Title: group name. Meta: "EUR · created 1 Oct · 31 payments · €1,240.00 spent" (sum of `fullAmount`).
- **Members** section: one row per member, sorted by name. Title: the name (nickname if set, as elsewhere). Meta: "Moderator" or "Member". Trailing: balance with `balance-indicator`. Tap opens the admin user detail.
- **Invite links** section, newest first:
  - Title: "Single use" or "Multi use". Meta by status: active "Expires in 5 days", used "Used by Tom · 3 Oct", expired "Expired 20 Oct", revoked "Revoked 27 Oct".
  - Active links have a trailing **Revoke** text button (destructive text). Others are muted, no button.
  - "No invite links" when none.
- **Revoke** opens a confirmation sheet: "Revoke this link?", "Nobody will be able to join with it any more.", a destructive **Revoke** and **Cancel**. Optimistic (`docs/design.md`, "Feels instant"): the row shows "Revoked" at once; if the server refuses, it goes back to active with a toast "Couldn't revoke the link".
- States: loading, not found, error with retry.

### Access

- Routes `/admin`, `/admin/users/:userId`, `/admin/groups/:groupId` sit behind `authGuard` plus an `adminGuard` that redirects a non-admin to `/home`.

## Backend

### `admin/` context (new, read model)

The overview spans users, groups, members, payments, sessions and invite links. It belongs to none of them: it's a read model for one audience, like `feed/` in the Settlement PR (#28, not merged into this branch's base). Its own context keeps those contexts unaware of the admin.

- **`domain/`**
  - `assertAdmin(user: { role }): void` throws `NotAnAdmin`. A pure rule, so it lives here; every admin use case calls it first.
  - The read types (`AdminOverview`, `AdminUserDetail`, `AdminGroupDetail`) and the port `ADMIN_READ_REPOSITORY` with `overview()`, `userDetail(userId)`, `groupDetail(groupId)` (null when not found).
  - `inviteLinkStatus(link, now)`: the status rule above, pure. (It may live in `invite-link/domain` instead and be reused here; builder's choice, as long as there is one implementation.)
- **`application/`**: `GetAdminOverviewUseCase`, `GetAdminUserUseCase`, `GetAdminGroupUseCase`. Read-only: no unit of work, they inject the repository token. Balances: the use cases get per-member totals from the existing `BALANCE_REPOSITORY` and run `netBalances`, so the balance rule stays in one place.
- **`infrastructure/`**: controller under `/admin`, module, `admin-read-repository.drizzle.ts` (SQL counts and joins). Errors: `NotAnAdmin` → 403 `NOT_AN_ADMIN`, not found → 404.

### `invite-link/` (extended)

Revoking changes an invite link, so it belongs to the invite-link context, not to `admin/`.

- Domain: `InviteLink.revokedAt`; `isRevoked`; preview, consume and the registration begin step (`findUsableByToken`) refuse a revoked link (same error and HTTP response as expired). A user who is already a member and opens a revoked link still gets "already a member", as with an expired link today.
- `RevokeInviteLinkUseCase`: load the caller, `assertAdmin`, load the link (404 if unknown), set `revokedAt` unless already revoked. One write, no unit of work.
- `POST /admin/invite-links/:id/revoke` → 204. Route under `/admin` for consistency; the controller can sit in `invite-link/infrastructure`.
- Schema: `invite_link.revoked_at timestamptz null`, then `db:generate`.

### `session/` (extended)

Revoking a session changes it, so it belongs to the session context.

- Sessions are keyed by their token, which must never leave the server. The `session` table gains an `id` (identity, unique; the token stays the primary key) so the admin API can reference a session. Then `db:generate`.
- `RevokeSessionUseCase`: `assertAdmin`, load by id (404 if unknown), refuse the caller's current session, `Session.revoke` unless already revoked or expired, save. One write, no unit of work.
- `POST /admin/sessions/:id/revoke` → 204.

### Contracts (`@ardoise/shared`, `adminApi`)

- `GET /admin/overview` → `{ counts: { users, groups, payments }, users: { id, name, role, createdAt, lastSignInAt | null, groupCount }[], groups: { id, name, currencyCode, createdAt, memberCount, paymentCount }[] }`
- `GET /admin/users/:userId` → `{ user: { id, name, role, createdAt, lastSignInAt | null, passkeyCount }, groups: { groupId, name, currencyCode, isModerator, memberCount, balance }[], sessions: { id, issuedAt, expiresAt, current }[] }` (`current` is true for the caller's own session)
- `GET /admin/groups/:groupId` → `{ group: { id, name, currencyCode, createdAt, paymentCount, totalSpent }, members: { memberId, userId, name, isModerator, balance }[], inviteLinks: { id, singleUse, status, expiresAt, burnedAt | null, burnedByName | null, revokedAt | null, createdAt }[] }`
- `POST /admin/invite-links/:id/revoke` → 204.
- `POST /admin/sessions/:id/revoke` → 204.
- Never expose session tokens, passkey material or invite tokens.

## Frontend placement

- `src/app/admin/`: `AdminApiService`, `adminGuard`, the three pages, and an `AdminStore` only if revoke needs shared state (builder's choice; the group detail page can hold it locally).
- Home: the admin entry button.
- Possibly a new building block in `shared/ui` for the three figures (`stat-figure`), if the existing text directives and `list-row` don't cover it. Called out in the PR.
- `docs/design.md`: log the admin overview layout (figures, Users / Groups tabs, detail sections) and the entry button.

## Testing

- **Unit** (pure domain): `assertAdmin`; `inviteLinkStatus` (each status, precedence revoked > used > expired); invite-link consume/preview refuse a revoked link.
- **Backend e2e** (`test/`, testcontainers):
  - Each admin endpoint: 401 without a session, 403 for a plain user, 200 for an admin.
  - Overview counts and lists, including a user with no group.
  - User detail: groups with role, member count and balance; active sessions only; 404.
  - Group detail: members with balances; invite link statuses; 404.
  - Revoke link: 204; a revoked link can't be previewed or consumed; revoking twice is 204; 404 unknown; 403 non-admin.
  - Revoke session: 204 and that session's cookie gets 401 afterwards; twice is 204; 404 unknown; 403 non-admin; 400 on the caller's own session.
- **Frontend unit**: entry button only for admins; `adminGuard` redirects; tabs and `?tab`; row wording (groups count, sign-in, roles, link statuses); revoke (link and session) optimistic and its rollback; no Revoke on "This device".
- **Playwright** (`apps/e2e/e2e/`), named as use cases: *an admin sees who is on the instance*, *an admin sees a user's groups*, *an admin revokes an invite link* (then joining with it fails), *an admin signs a user's session out* (that user is sent back to login), *a regular user has no admin panel* (no button, `/admin` redirects home).
- **Screenshot matrix**: home with the admin button, overview Users and Groups tabs, loading, error, user detail (with groups, with no group), group detail (links in every status), revoke link sheet, user sessions with "This device", revoke session sheet, not found. Light and dark.
- **Seed**: the primary account becomes admin (the seed spec asserts it for both Alice and a kept real account); a user with no group; invite links in every status in Lisbon (active, used, expired, revoked). `docs/domain.md` and the seed spec follow.

## Docs

- `docs/domain.md`: `InviteLink.revokedAt` and the status rule; "Only an admin may read the admin overview or revoke invite links through it."
- `docs/roadmap.md`: an **Admin** section with this slice done, and the deferred items as unchecked entries: account management, richer invite links (uses, validity, no group), instance settings, a proper admin bootstrap for prod (instead of the seed), passkey management for the admin and for the user (delete, re-create for a user, several passkeys), next to the existing multi-device entry.
- `docs/design.md`: the decision log entries above.

## Left to the builder

- The exact SQL for counts and last sign-in.
- Where `inviteLinkStatus` lives, as long as there is one implementation.
- Whether the three figures need a new building block.
- Relative-date wording helper ("today", "2 days ago"), reusing `dayLabel` where it fits.

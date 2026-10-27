# Admin Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only admin panel (overview, user detail, group detail) for `User.role = 'admin'`, plus revoking invite links and sessions.

**Architecture:** A new read-model context `admin/` serves three GET endpoints and owns `assertAdmin`. Revocations are writes, so they live in `invite-link/` and `session/`. Frontend: `src/app/admin/` with three pages behind an `adminGuard`, entered from a home button shown only to admins.

**Tech Stack:** NestJS 12, Drizzle + PostgreSQL, Zod (`@ardoise/shared`), Angular 22 signals, spartan helm, vitest, testcontainers, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-admin-overview-design.md`

## Global Constraints

- Only `role = 'admin'` reaches `/admin/*` (403 `NOT_AN_ADMIN`); non-admins see no entry button and `/admin` redirects to `/home`.
- Never expose session tokens, passkey material or invite tokens.
- Invite link status precedence: `revoked` > `used` (single use and burned) > `expired` > `active`.
- A revoked link answers exactly like an expired one (`INVITE_EXPIRED`) on preview, consume and begin-registration.
- Revoking an already revoked/expired/used link or session: 204 no-op. Revoking the caller's current session: 400 `CANNOT_REVOKE_CURRENT_SESSION`.
- Last sign-in = latest `session.issuedAt`.
- Copy (exact): entry `aria-label="Admin"`; title "Admin"; figures "Users" / "Groups" / "Payments"; tabs "Users" / "Groups"; marker "Admin"; "No group"; sections "Groups", "Sessions", "Members", "Invite links"; "No active session"; "No invite links"; "This device"; link titles "Single use" / "Multi use"; button "Revoke"; link sheet "Revoke this link?" + "Nobody will be able to join with it any more."; session sheet "Sign this session out?" + "This device will need the passkey to sign in again."; "Cancel"; toasts "Couldn't revoke the link" / "Couldn't revoke the session".
- Seed makes its primary account admin everywhere (owner's pick (a)).
- Templates: helm + `shared/ui`, Tailwind layout only, text directives, no arbitrary values, no component CSS. Commits: one line.

## Review Focus

- A link revoked between preview and registration must still be refused at begin-registration. → Task 1 e2e `begin registration refuses a revoked link`.
- Revoking the admin's own session must not be possible through the API even if the UI hides it. → Task 3 e2e `refuses the caller's current session`.
- A revoked session's cookie must stop working at once. → Task 3 e2e `revoked session gets 401`.
- A user with no group and no session must render (no NaN, no crash). → Task 2 e2e `overview lists a user with no group`, Task 5 spec `user with no group`.
- A plain user typing `/admin/groups/1` must be redirected, not shown an error page. → Task 4 spec `adminGuard redirects a plain user`.

---

### Task 1: Schema, invite-link revocation in the domain, session id

**Files:**
- Modify: `apps/backend/src/shared/database/schema.ts` (`invite_link.revokedAt` timestamptz null; `session.id` integer identity unique, token stays PK) + `db:generate`
- Modify: `apps/backend/src/invite-link/domain/invite-link.ts` (+ new `invite-link.spec.ts`), `consume-invite-link.ts`, `preview-invite-link.ts`, `infrastructure/invite-link-repository.drizzle.ts` (`isUsable` adds `isNull(revokedAt)`, `toDomain` maps it)
- Modify: `apps/backend/src/session/domain/session.ts` (`id: number`), `session-repository.drizzle.ts` mapping; `Session.issue` callers keep working (id assigned by DB: `issue` returns a type without `id` or `save` ignores it — implementer's choice, keep it compiling)
- Test: `apps/backend/test/invite-link.e2e-spec.ts` (extend)

**Interfaces:**
- Produces: `InviteLink.revokedAt: Date | null`; `InviteLink.isRevoked(link): boolean`; `InviteLink.status(link, now): 'active' | 'used' | 'expired' | 'revoked'`; `InviteLinkRepository.findById(id): Promise<InviteLink | null>`, `revoke(id, now): Promise<void>`; `Session.id: number`; `SessionRepository.findById(id): Promise<Session | null>`.

- [ ] **Step 1: Failing unit tests** `invite-link.spec.ts`: status precedence (revoked+burned → revoked; burned single-use → used; multi-use burned-by-null past expiry → expired; else active); preview and consume throw `InviteLinkExpired` for a revoked, unexpired link.
- [ ] **Step 2: Failing e2e**: preview of a revoked link → same status/body as expired; `begin registration refuses a revoked link`; joining as an existing user with a revoked link refused.
- [ ] **Step 3:** Implement; `db:generate`. **Step 4:** `pnpm --filter @ardoise/backend test` and `test:e2e invite` PASS, backend typecheck clean.
- [ ] **Step 5:** Commit `feat(backend): invite links can be revoked, sessions get an id`.

### Task 2: Admin read endpoints

**Files:**
- Create: `apps/backend/src/admin/domain/admin.ts` (+ spec), `admin-read-repository.ts`; `application/get-admin-overview.use-case.ts`, `get-admin-user.use-case.ts`, `get-admin-group.use-case.ts`; `infrastructure/admin.controller.ts`, `admin.module.ts`, `admin-read-repository.drizzle.ts`
- Create: `apps/backend/src/shared/http/admin-exception.filter.ts`; Modify `app.module.ts`
- Create: `libs/shared/src/contracts/admin.ts` (+ export)
- Test: `apps/backend/test/admin-overview.e2e-spec.ts`, `admin-user.e2e-spec.ts`, `admin-group.e2e-spec.ts`; `test/helpers/seed.ts` `seedUser` already takes `role`

**Interfaces:**
- Domain: `class NotAnAdmin extends Error`, `class AdminUserNotFound`, `class AdminGroupNotFound`; `assertAdmin(user: { role: 'user' | 'admin' }): void`.
- Port `ADMIN_READ_REPOSITORY`: `overview(): Promise<AdminOverview>`, `user(userId): Promise<{ user; groups: { groupId; name; currencyCode; isModerator; memberCount; memberId }[]; sessions: { id; token; issuedAt; expiresAt }[] } | null>`, `group(groupId): Promise<{ group; members; inviteLinks } | null>`. Balances come from `BALANCE_REPOSITORY.totalsByGroup` + `netBalances` in the use case (one balance rule). Session `current` = `session.token === currentToken` computed in the use case; the token is dropped before the response.
- Contracts `adminApi` exactly as the spec's "Contracts" section; `overview`, `user` (path `/admin/users/:userId`), `group` (`/admin/groups/:groupId`), `revokeInviteLink`, `revokeSession` (Task 3). Dates as ISO strings.
- Controller reads the current session token with `getCookie(req, SESSION_COOKIE_NAME)` and passes it to `GetAdminUserUseCase.execute({ caller, userId, currentToken })`.
- Errors: `NotAnAdmin` → 403 `{ error: 'NOT_AN_ADMIN' }`; not-found → 404.

- [ ] **Step 1: Failing unit test**: `assertAdmin` passes for admin, throws `NotAnAdmin` for user.
- [ ] **Step 2: Failing e2e** (each file: 401 no cookie, 403 plain user):
  - overview: counts `{ users: 3, groups: 2, payments: 1 }`; users sorted by name with `groupCount`, `lastSignInAt` = latest session `issuedAt` or null; `overview lists a user with no group` (groupCount 0).
  - user: groups with `isModerator`, `memberCount`, `balance` (one equal payment 3000 between two → +1500 / −1500); sessions only active ones, `current: true` for the caller's own; 404 unknown.
  - group: `paymentCount`, `totalSpent`; members sorted by name with balances; invite links newest first with `status` for each of active/used (with `burnedByName`)/expired/revoked; no `token` field anywhere (`expect(JSON.stringify(body)).not.toContain(token)`); 404 unknown.
- [ ] **Step 3:** Implement. **Step 4:** e2e + typecheck green. **Step 5:** Commit `feat(backend): admin overview, user and group read endpoints`.

### Task 3: Revoke invite links and sessions (backend)

**Files:**
- Create: `apps/backend/src/invite-link/application/revoke-invite-link.use-case.ts`, `apps/backend/src/session/application/revoke-session.use-case.ts`; controllers: `invite-link/infrastructure/admin-invite-link.controller.ts`, `session/infrastructure/admin-session.controller.ts` (register in their modules)
- Modify: `session/domain/session.ts` (`class CannotRevokeCurrentSession`), exception filters (400 `CANNOT_REVOKE_CURRENT_SESSION`; link/session not found → 404)
- Test: `apps/backend/test/admin-revoke.e2e-spec.ts`

**Interfaces:**
- `RevokeInviteLinkUseCase.execute({ caller: SessionUser; inviteLinkId }): Promise<void>` — `assertAdmin`, `findById` (404), `revoke(id, now)` unless already revoked.
- `RevokeSessionUseCase.execute({ caller; sessionId; currentToken }): Promise<void>` — `assertAdmin`, `findById` (404), `CannotRevokeCurrentSession` if token matches, `Session.revoke` + `save` unless already revoked/expired.
- Routes `POST /admin/invite-links/:id/revoke`, `POST /admin/sessions/:id/revoke` → 204 (from `adminApi`).

- [ ] **Step 1: Failing e2e**: link revoke 204 then preview gives `INVITE_EXPIRED`; twice 204; 404; 403 plain user. Session revoke 204 then `revoked session gets 401` on `/auth/me` with that cookie; twice 204; 404; 403 plain user; `refuses the caller's current session` (400 `CANNOT_REVOKE_CURRENT_SESSION`).
- [ ] **Step 2–4:** FAIL → implement → full backend e2e + typecheck green.
- [ ] **Step 5:** Commit `feat(backend): admins revoke invite links and sessions`.

### Task 4: Admin entry, guard and overview page (frontend)

**Files:**
- Create: `apps/frontend/src/app/admin/admin-api.service.ts`, `admin.guard.ts` (+ spec), `admin-overview/admin-overview.ts/.html/.spec.ts`, `admin-dates.ts` (+ spec)
- Modify: `apps/frontend/src/app/app.routes.ts` (`admin`, `admin/users/:userId`, `admin/groups/:groupId`, all `[authGuard, adminGuard]`, lazy), `home/home/home.html/.ts/.spec.ts`

**Interfaces:**
- `adminGuard: CanActivateFn` — `AuthService.currentUser()`; admin → true, else `UrlTree('/home')`.
- `signedInLabel(date: string | null, joined: string, now: Date): string` → "signed in today" / "signed in 2 days ago" / "joined yesterday" (when null); `expiresInLabel(date, now)` → "Expires in 5 days" / "expires in 26 days" (caller capitalises). Reuse `dayLabel` only if it fits.
- Overview: figures row (new `shared/ui/stat-figure` only if `appFigure` + `appEyebrow` in a flex row don't suffice — builder's choice, call out if created); `?tab=groups` with `replaceUrl`; user row meta "4 groups · signed in today" / "No group · joined yesterday", singular "1 group"; group row meta "5 members · 31 payments · EUR".

- [ ] **Step 1: Failing specs**: home `shows the Admin button only to admins`; `adminGuard redirects a plain user`; overview renders counts, user rows (with Admin marker), switches to Groups via `?tab=groups` without history entry, loading and error-with-retry; `admin-dates` wording.
- [ ] **Step 2–4:** FAIL → implement → `pnpm --filter @ardoise/frontend test`, typecheck, lint green.
- [ ] **Step 5:** Commit `feat(frontend): admin entry and overview`.

### Task 5: User and group detail pages with revocation (frontend)

**Files:**
- Create: `apps/frontend/src/app/admin/admin-user/admin-user.ts/.html/.spec.ts`, `admin-group/admin-group.ts/.html/.spec.ts`

**Interfaces:**
- User page: meta "Joined 12 Oct · signed in 2 days ago · 1 passkey"; Groups rows → `/admin/groups/:groupId` with `balance-indicator` trailing; Sessions rows "Signed in 27 Oct · expires in 26 days", current shows "This device", others a destructive-text **Revoke** opening the session sheet; optimistic remove, rollback + toast.
- Group page: meta "EUR · created 1 Oct · 31 payments · €1,240.00 spent"; Members → `/admin/users/:userId` with `balance-indicator`; Invite links meta per status (spec copy), active ones get **Revoke** → link sheet; optimistic status "revoked", rollback + toast.
- Not found (404) → `page-state` empty with "Back" to `/admin`; error with retry; loading skeleton.

- [ ] **Step 1: Failing specs**: user page groups and sessions, `user with no group` shows "No group" section text and no crash, no Revoke on "This device", revoke session calls API with the id and removes the row, rollback on error with toast. Group page members and links per status, Revoke only on active, confirm calls API, row turns "Revoked …", rollback on error.
- [ ] **Step 2–4:** FAIL → implement → frontend tests, typecheck, lint green.
- [ ] **Step 5:** Commit `feat(frontend): admin user and group details with revocation`.

### Task 6: Seed, scenarios, screenshots, docs

**Files:**
- Modify: `apps/backend/scripts/seed/demo-scenario.ts`, `scripts/seed-dev.ts`, `test/seed-dev.e2e-spec.ts`
- Create: `apps/e2e/e2e/an-admin-sees-who-is-on-the-instance.spec.ts`, `an-admin-sees-a-users-groups.spec.ts`, `an-admin-revokes-an-invite-link.spec.ts`, `an-admin-signs-a-users-session-out.spec.ts`, `a-regular-user-has-no-admin-panel.spec.ts`; fixtures (`makeAdmin(userName)` SQL helper in `e2e/fixtures/db.ts`)
- Modify: `apps/e2e/screenshots/fixtures.ts`, `matrix.ts`; `docs/domain.md`, `docs/design.md`, `docs/roadmap.md`

- [ ] **Step 1: Failing seed spec**: primary account role is `admin` (Alice case and kept-real-account case); a user with no group exists; Lisbon has invite links in each status.
- [ ] **Step 2:** Implement the seed; spec green.
- [ ] **Step 3:** Playwright scenarios (roles and text only): admin sees counts and users; opens a user and sees their groups; revokes a link, then a fresh page joining with that token sees the expired-invite screen; revokes another user's session, then that user's next navigation lands on login; a plain user sees no Admin button and `/admin` lands on `/home`. `pnpm --filter @ardoise/e2e test:e2e` green.
- [ ] **Step 4:** Screenshot cells per spec (home with Admin button, overview users/groups, loading, error, user detail with groups / no group, sessions with "This device", session sheet, group detail with every link status, link sheet, not found), light + dark; run `pnpm --filter @ardoise/e2e screenshots`.
- [ ] **Step 5:** Docs: `domain.md` (`InviteLink.revokedAt`, status rule, `Session.id`, admin rule); `design.md` log (admin entry, overview figures + tabs, detail sections, revoke sheets); `roadmap.md` new **Admin** section: this slice ticked; unchecked: account management, richer invite links, instance settings, proper admin bootstrap for prod, passkey management (admin and user) next to multi-device.
- [ ] **Step 6:** `pnpm verify` green. Commits: `chore(backend): dev seed makes the primary account admin`, `test(e2e): admin scenarios and screenshot cells`, `docs: admin overview design log, domain rules and roadmap`.

# Personal settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings screen reached from home (name, theme, sign out, version), and an optional name step when a newcomer joins through an invite link.

**Architecture:** Backend adds a rename use case in the `user` context behind `PATCH /users/me`, and an optional `name` on registration complete. Frontend adds a `/settings` page assembled from helm components and existing building blocks, a rename path through `AuthService` so the cached current user stays the single source of my name, and a name step inside the accept-invite page.

**Tech Stack:** NestJS 12, Drizzle, Zod (`@ardoise/shared`), Angular 22 standalone + spartan helm, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-personal-settings-design.md`

## Global Constraints

- Copy is English. Exact strings come from the spec and are repeated in each task.
- Name: trimmed, 1 to 50 characters. One schema, `userNameSchema`, in `@ardoise/shared`, used by rename and registration. Frontend inputs use `USER_NAME_MAX_LENGTH` (50) from the same file.
- Registration without a name keeps `user-${crypto.randomUUID()}`.
- Theme stays per device through the existing `ThemeService`; no backend.
- No realtime event for a rename.
- Feature templates: helm + `shared/ui` blocks, Tailwind for layout and spacing only, text directives for type, no arbitrary values, no component CSS, no inline styles.
- No code comments. Commit messages are a single line.
- `pnpm typecheck` before calling any task done (vitest and eslint do not typecheck).

## Review Focus

1. A name of only spaces: rejected by the backend (400, nothing changed), Save disabled in the sheet, sent as no name at registration. Tests: Task 1 e2e, Task 4 spec, Task 5 spec.
2. A name with surrounding spaces is stored trimmed, and "unchanged" in the sheet compares the trimmed value with the current name. Tests: Task 1 e2e, Task 4 spec.
3. After a rename, every screen reading `AuthService.currentUser()` shows the new name without a reload. Test: Task 4 spec (`AuthService.rename` replaces the cache).
4. `/version.json` missing (local dev), malformed, or `sha: "dev"` shows `Version dev` and never throws. Test: Task 3 spec.
5. Signing out while the request fails keeps me signed in, with the sheet open and the error shown. Test: Task 3 spec.

---

### Task 1: Rename my name (backend)

Why here: renaming is about the user, so the use case lives in `user/application`. It is a single write with no rule beyond the contract's shape, so there is no domain function and no unit of work. Validation lives in the Zod contract.

**Files:**
- Create: `libs/shared/src/contracts/user.ts`, export it from `libs/shared/src/index.ts`
- Modify: `apps/backend/src/user/domain/user-repository.ts`, `apps/backend/src/user/infrastructure/user-repository.drizzle.ts`
- Create: `apps/backend/src/user/application/rename-user.use-case.ts`
- Create: `apps/backend/src/user/infrastructure/user.controller.ts`, `apps/backend/src/user/infrastructure/user-http.module.ts`
- Modify: `apps/backend/src/app.module.ts`
- Test: `apps/backend/test/rename-user.e2e-spec.ts`

**Interfaces:**
- Produces (shared): `USER_NAME_MAX_LENGTH = 50`; `userNameSchema = z.string().trim().min(1).max(USER_NAME_MAX_LENGTH)`; `renameUserRequestSchema = z.object({ name: userNameSchema })`, `type RenameUserRequest`; `userApi.renameMe = { method: 'PATCH', path: '/users/me', status: 200, body: renameUserRequestSchema, res: meResponseSchema }`.
- Produces (backend): `UserRepository.rename(id: number, name: string): Promise<User>`; `RenameUserUseCase.execute({ userId: number; name: string }): Promise<User>`, which throws `UserNotFound` when there is no row.

- [ ] **Step 1: Write the failing e2e spec** `rename-user.e2e-spec.ts`. Use `setupTestApp`, `seedUser`, and `seedSession` with the session cookie as in `group-members.e2e-spec.ts`. Truncate `session, users` after each test. Cases:
  - `renames me`: PATCH `/users/me` `{ name: 'Gabriel' }` → 200, and the body matches `{ id, name: 'Gabriel', role: 'user' }`; then POST `/auth/me` returns `name: 'Gabriel'`.
  - `trims the name`: `{ name: '  Gabriel  ' }` → stored `name` in `users` is `'Gabriel'`.
  - `refuses a blank name`: `{ name: '   ' }` → 400, and the DB name is unchanged.
  - `refuses a name over 50 characters`: `'a'.repeat(51)` → 400, unchanged. `'a'.repeat(50)` → 200.
  - `refuses without a session`: no cookie → 401.
- [ ] **Step 2: Run it and see it fail.** `pnpm --filter @ardoise/backend test:e2e rename-user`. Expected: 404 on PATCH.
- [ ] **Step 3: Add the contract**, then `rename` in the repository (`update … set name … where id … returning`, mapped through `toDomain`), the use case, and the controller: `@UseGuards(SessionGuard)`, `@Route(userApi.renameMe)`, body piped through `ZodValidationPipe(userApi.renameMe.body)`, returning `{ id, name, role }`.
- [ ] **Step 4: Wire the module.** `UserHttpModule` imports `UserModule` and `SessionModule`, and declares `UserController` and `RenameUserUseCase`. Add it to `AppModule`. It is a separate module because `SessionModule` already imports `UserModule`, so having `UserModule` import `SessionModule` for the guard would create a cycle.
- [ ] **Step 5: Run the spec and see it pass.** Then run `pnpm typecheck`.
- [ ] **Step 6: Commit** `feat(user): rename my name through PATCH /users/me`

### Task 2: Name at registration (backend)

**Files:**
- Modify: `libs/shared/src/contracts/auth.ts` (`completeRegistrationRequestSchema` gains `name: userNameSchema.optional()`)
- Modify: `apps/backend/src/auth/application/complete-registration.use-case.ts` (input `name?: string`; `name: input.name ?? \`user-${crypto.randomUUID()}\``)
- Test: `apps/backend/test/authentication.e2e-spec.ts`

**Interfaces:**
- Consumes: `userNameSchema` (Task 1).
- Produces: `CompleteRegistrationRequest.name?: string`.

- [ ] **Step 1: Add the failing cases** under `describe('register')`:
  - `registers with my name`: complete with `name: '  Ana  '` → the `users` row has `name: 'Ana'`.
  - `registers without a name`: the existing flow → `name` matches `/^user-[0-9a-f-]{36}$/`.
  - `refuses a blank name at registration`: `name: '  '` → 400, and no row in `users`.
- [ ] **Step 2: Run the cases and see them fail.** `pnpm --filter @ardoise/backend test:e2e authentication`
- [ ] **Step 3: Implement.** The controller already spreads `body`, so check that `name` reaches the use case.
- [ ] **Step 4: Run the cases and see them pass**, then run `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(auth): optional name at registration`

### Task 3: Settings page with theme, sign out and version, plus the home entry (frontend)

**Files:**
- Create: `apps/frontend/src/app/settings/settings.ts`, `settings.html`, `settings.spec.ts`
- Create: `apps/frontend/src/app/shared/version/app-version.ts`, `app-version.spec.ts`
- Modify: `apps/frontend/src/app/app.routes.ts` (`path: 'settings'`, lazy `Settings`, `canActivate: [authGuard]`)
- Modify: `apps/frontend/src/app/home/home/home.html`, `home.ts` (add the `lucideSettings` icon)

**Interfaces:**
- Produces: `versionLabel(body: unknown): string` (pure function); `AppVersion` (`providedIn: 'root'`) with `readonly label: Signal<string>`, which fetches `VERSION_URL` once with `cache: 'no-store'` and starts at `'Version dev'`.
- `versionLabel` returns `` `Version ${sha.slice(0, 7)} · ${date}` `` where `date` is `new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })` applied to `body.date`. It returns `'Version dev'` when the body is not an object, `sha` is missing, not a string or `'dev'`, or `date` is not a valid date.

- [ ] **Step 1: Write `app-version.spec.ts`.** Cases:
  - `{ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' }` → `'Version a1b2c3d · 3 Nov 2026'`
  - `{ sha: 'dev', date: '' }` → `'Version dev'`
  - `null` → `'Version dev'`
  - `{ sha: 'a1b2c3d', date: 'nope' }` → `'Version dev'`
  - `AppVersion.label` stays `'Version dev'` when fetch rejects or returns 404.
- [ ] **Step 2: Run it and see it fail.** Then implement `app-version.ts` and run it again to see it pass. `pnpm --filter @ardoise/frontend test app-version`
- [ ] **Step 3: Write `settings.spec.ts`**, faking `AuthService` (`currentUser`, `logout`) and `AppVersion`. Cases:
  - `shows the theme choice and applies it at once`: the radio "Dark" in the "Theme" toggle group is checked after a click, and `ThemeService.preference()` is `'dark'`.
  - `asks before signing out`: clicking the "Sign out" row opens a dialog "Sign out?" with "You'll need your passkey on this device to sign back in."; "Cancel" closes it, and `logout` was not called.
  - `signs out and goes to login`: confirm → `logout` called once → router at `/login`.
  - `keeps me signed in when sign out fails`: `logout` errors → the dialog is still open, `"Couldn't sign out. Try again."` is shown, and the confirm button is enabled again.
  - `shows the version`: the text `Version a1b2c3d · 3 Nov 2026` from the faked `AppVersion`.
- [ ] **Step 4: Run it and see it fail.**
- [ ] **Step 5: Build the page.**
  - Use the mobile shell header from `payment-details.html`: a back button `aria-label="Back"` to `/home`, then `<h1 appTitle>Settings</h1>`.
  - Section "Theme" (`appEyebrow`): `hlm-toggle-group` with System / Light / Dark, bound to `ThemeService.preference` / `setPreference`.
  - A `list-row` button "Sign out" in the destructive text color, which opens an `hlm-sheet`. The sheet has the title "Sign out?", the description above, then `variant="destructive"` "Sign out" and `variant="outline"` "Cancel" (`size="xl"`).
  - While the sign-out request is in flight, the confirm button is disabled. The error uses `appError`.
  - Footer: `<p appMeta>` with `AppVersion.label()`.
  - Leave a "Profile" section placeholder out; Task 4 adds it above Theme.
- [ ] **Step 6: Add the home entry.** In `home.html`, put both header buttons in a flex group: the admin shield (unchanged, still conditional), then an `<a aria-label="Settings" routerLink="/settings">` with the same classes, size and variant as the admin link, holding `lucideSettings`. Update `home.spec.ts` only if it asserts the header's children.
- [ ] **Step 7: Run the specs and see them pass.** `pnpm --filter @ardoise/frontend test settings home`, then `pnpm typecheck` and `pnpm lint`.
- [ ] **Step 8: Commit** `feat(settings): settings page with theme, sign out and version`

### Task 4: Name row and name sheet (frontend)

Why `AuthService`: it already owns the cached current user. Renaming through it replaces that cache, so every reader of `currentUser()` sees the new name with no second store.

**Files:**
- Create: `apps/frontend/src/app/user/user-api.service.ts`
- Modify: `apps/frontend/src/app/auth/auth.service.ts`, `auth.service.spec.ts`
- Modify: `apps/frontend/src/app/settings/settings.ts`, `settings.html`, `settings.spec.ts`

**Interfaces:**
- Consumes: `userApi.renameMe`, `RenameUserRequest`, `USER_NAME_MAX_LENGTH` (Task 1).
- Produces: `UserApiService.renameMe(body: RenameUserRequest): Observable<MeResponse>`; `AuthService.rename(name: string): Observable<MeResponse>`, which on success sets `cachedUser` to `of(updated)` so that `currentUser()` emits the new name.

- [ ] **Step 1: Add the failing `auth.service.spec.ts` case** `rename replaces the current user`: after `rename('Ana')` resolves, `currentUser()` emits `name: 'Ana'` without a second `me` call.
- [ ] **Step 2: Add the failing `settings.spec.ts` cases:**
  - `shows my name`: the row "Name" shows `Gabriel`. Under it: "Shown to everyone in your groups."
  - `opens the name sheet prefilled`: click the row → dialog "Your name", textbox value `Gabriel`, `maxlength` 50.
  - `disables Save for a blank or unchanged name`: value `'   '` → Save disabled; value `' Gabriel '` → Save disabled; value `Ana` → enabled.
  - `saves the trimmed name and closes`: value `'  Ana '` → Save → `rename` called with `'Ana'` → the dialog closes → the row shows `Ana`.
  - `keeps my edit when saving fails`: `rename` errors → dialog open, value `Ana` kept, `"Couldn't save your name. Try again."` shown, Save enabled.
- [ ] **Step 3: Run them and see them fail.**
- [ ] **Step 4: Implement.**
  - `UserApiService` uses `createApiClient(userApi, …)`, the same way `AuthApiService` does.
  - `AuthService.rename` calls the API and replaces the cache with a `tap`.
  - In the page, add a "Profile" eyebrow above Theme. Below it, a `list-row` button with the title "Name", the trailing name and a chevron, then `<p appMeta>Shown to everyone in your groups.</p>`. The row opens a second `hlm-sheet` titled "Your name" with the same description.
  - The sheet holds a `<form>` with an `hlmInput` (`[maxLength]` 50, autofocus, `enterkeyhint="done"`) and a submit `hlmBtn size="xl"` "Save". While the request is in flight, the input is read-only and Save is disabled.
  - Closing the sheet resets the draft to the current name.
- [ ] **Step 5: Run the specs and see them pass**, then run `pnpm typecheck` and `pnpm lint`.
- [ ] **Step 6: Commit** `feat(settings): change my name from settings`

### Task 5: Name step when joining as a newcomer (frontend)

**Files:**
- Modify: `apps/frontend/src/app/auth/auth.service.ts` (`register(inviteToken: string, name?: string)`, which passes `name` to `registerComplete`)
- Modify: `apps/frontend/src/app/invite-link/accept-invite-flow.service.ts` (`registerThenJoin(token: string, name?: string)`)
- Modify: `apps/frontend/src/app/invite-link/accept-invite/accept-invite.ts`, `accept-invite.html`, `accept-invite.spec.ts`

**Interfaces:**
- Consumes: `CompleteRegistrationRequest.name` (Task 2), `USER_NAME_MAX_LENGTH`.
- Produces: the `loggedOut` state gains a local `naming = signal(false)`, and `registerThenJoin()` reads the input's trimmed value and sends `undefined` when it is empty.

- [ ] **Step 1: Add the failing `accept-invite.spec.ts` cases:**
  - `asks for my name before the passkey`: clicking "New here? Join with a passkey" shows a textbox labelled "Your name" with the placeholder "Optional", the text "Shown to everyone in your groups. You can change it later in Settings." and a "Create passkey" button. `register` has not been called yet.
  - `sends the trimmed name`: type `'  Ana '` → "Create passkey" → `registerThenJoin` called with `(token, 'Ana')`.
  - `sends no name when left blank`: `'   '` → called with `(token, undefined)`.
  - `goes back to the two choices`: "Back" → "Log in to join …" and "New here? Join with a passkey" visible again.
  - Update the existing register cases so they go through "Create passkey".
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.** In `@case ('loggedOut')`:
  - When `naming()` is true, the two buttons are replaced in place by a `<form>`. It holds the input (`hlmInput`, `id="join-name"`, `<label appMeta for="join-name">Your name</label>`, `maxLength` 50, autofocus), the `appMeta` line, an `inverted` `size="xl"` submit button with `lucideKeyRound` and "Create passkey", and a `variant="link"` "Back" button. Pick button variants that read on the hero backdrop, as the existing ones do.
  - Thread `name` through `AcceptInviteFlow` and `AuthService.register`.
- [ ] **Step 4: Run the specs and see them pass**, then run `pnpm typecheck` and `pnpm lint`.
- [ ] **Step 5: Commit** `feat(invite): optional name when joining as a newcomer`

### Task 6: Playwright scenarios, screenshots, docs

**Files:**
- Modify: `apps/e2e/e2e/fixtures/group.ts` and the specs that click "New here? Join with a passkey" (`auth-guard`, `invite-people-from-an-existing-group`, `create-group-and-invite`, `join-with-invite`, `login-logout`). After that click they now also click "Create passkey".
- Modify: `apps/e2e/e2e/join-with-invite.spec.ts`: type `Ana`, and after landing on home open Settings and expect the row "Name" with `Ana`.
- Create: `apps/e2e/e2e/change-my-name.spec.ts`: join a group as a newcomer without a name, open Settings, change the name to `Ana`, open the group, and expect `Ana` in its member list.
- Modify: `apps/e2e/e2e/login-logout.spec.ts`: replace the raw `POST /api/auth/logout` with Settings → "Sign out" → confirm "Sign out" → URL `/login`, then `/home` redirects to `/login`, then log back in as today.
- Modify: `apps/e2e/screenshots/matrix.ts` and `fixtures.ts`: add the cells `settings` (default), `settings/name-sheet`, `settings/name-sheet-error` (`PATCH /users/me` → 500), `settings/sign-out-sheet`, and `join/name-step`. Mock `/version.json` with `{ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' }`.
- Modify: `docs/roadmap.md`: tick the settings page and logout control. `docs/domain.md`: `User.name` is trimmed, 1 to 50 characters, and defaults to `user-<uuid>`.
- Modify: `apps/backend/scripts/seed-dev.ts`: add one report line noting that real accounts keep their `user-…` name until renamed in Settings. Demo users already have readable names.

- [ ] **Step 1: Update the shared join helper and the specs**, then run `pnpm --filter @ardoise/e2e test:e2e`. Expected: all pass, including the new and changed scenarios. Keep the run sequential.
- [ ] **Step 2: Add the matrix cells.** Run `pnpm --filter @ardoise/e2e screenshots` with `pnpm dev:front` running. Expected: the new PNGs in `apps/e2e/screenshots-out/` in light and dark. Look at each one.
- [ ] **Step 3: Update the docs and seed-dev**, then run `pnpm verify`. Expected: green.
- [ ] **Step 4: Commit** `test(settings): scenarios and screenshots for settings and named join`

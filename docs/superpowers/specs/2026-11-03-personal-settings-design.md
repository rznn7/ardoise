# Personal settings

The Personal settings slice in `docs/roadmap.md`: one screen for what belongs to me rather than to a
group. Choose the theme, set my name, sign out, see which version of the app I'm running.

## Why

- **Name.** Every account is created as `user-<uuid>` (`complete-registration.use-case.ts`). Nothing lets
  anyone change it, so groups are full of unreadable names. That is the most urgent of the four.
- **Theme.** `ThemeService` already handles system / light / dark and remembers the choice, but no UI
  exposes it.
- **Sign out.** The backend endpoint and `AuthService.logout` exist, but no button calls them.
- **Version.** `/version.json` (sha + date) is already published by the web image for reload-on-deploy.
  Showing it tells the owner which build a phone is running.

## Goals

- From home, one tap opens Settings, for every user, admin or not.
- I can change my global name (`User.name`): the one everyone sees in every group where I have no
  nickname.
- When I join through an invite link as a new user, I can type my name before creating the passkey.
  It is optional: left empty, the account gets `user-<uuid>` as today.
- I pick System, Light or Dark. It applies at once. System is the default.
- I sign out after a confirmation and land on the login screen.
- I see the running version at the bottom of Settings.

## Non-goals

- Per-group nicknames (`Member.nickname`). The owner chose the global name.
- A friendlier default name. The owner: "gardons le user-uuid pour l'instant".
- Syncing the theme across devices. It stays in localStorage, per device, as today.
- Asking for the name when an existing user joins a new group, or when logging in.
- Account deletion, passkey management, avatars.

## Anti-goals

- Signing out with a single stray tap.
- A name saved with surrounding spaces, or an empty name.
- Other members still seeing my old name until they reload.

## Screens

Copy is English, like the rest of the app.

### Home header

A ghost icon button `lucideSettings` (`aria-label="Settings"`, same size as the admin button) at the
right of the header, after the admin shield when it is shown. It links to `/settings`.

### Settings (`/settings`, `authGuard`)

Mobile shell, header with a back button (to `/home`) and the title "Settings". From top to bottom:

1. **Profile** (eyebrow). One list row: label "Name", trailing value = my current name, chevron.
   Under the list: meta text "Shown to everyone in your groups." Tapping the row opens the name sheet.
2. **Theme** (eyebrow). A three-option toggle group: System / Light / Dark, showing the current
   preference. Selecting one calls `ThemeService.setPreference`. No save button.
3. A list row "Sign out" in the destructive color. Tapping it opens the sign-out sheet.
4. Footer, meta text, bottom of the page: `Version <first 7 chars of sha> · <date>`, with the date
   formatted like the rest of the app (e.g. `3 Nov 2026`). When `/version.json` cannot be read or
   says `dev` (local dev), it shows `Version dev`.

States:
- Name loading (current user not resolved yet): the row's trailing value is empty. Theme, sign out and
  version do not wait for it.
- `/me` failing is already handled by `authGuard` (redirect to login), so there is no error state for it.

### Name sheet (bottom sheet)

Title "Your name", description "Shown to everyone in your groups.", a text input prefilled with my
current name and focused, a full-width "Save" button.

- The value is trimmed. Save is disabled when the trimmed value is empty, or equals the current name.
- Max length 50 (my call: long enough for a full name, short enough for list rows). The input caps it.
- Saving: the button shows it is busy and the input is read-only. On success the sheet closes, and the
  row shows the new name.
- Failure: the sheet stays open with the value kept, and an `appError` line "Couldn't save your name. Try
  again." Save is enabled again.
- Enter submits. Closing the sheet without saving discards the edit.

Tap count for renaming: 1 (gear) + 1 (row) + typing + 1 (Save) from home.

### Sign-out sheet (bottom sheet)

Title "Sign out?", description "You'll need your passkey on this device to sign back in.", a
destructive "Sign out" button, then an outline "Cancel" button.

- Confirming: the button shows it is busy. On success, the existing `signedOut` flow runs, and the app
  navigates to `/login`.
- Failure: the sheet stays open with an `appError` line "Couldn't sign out. Try again."

### Accept invite, new user

In the `loggedOut` state, "New here? Join with a passkey" no longer starts the passkey right away.
It swaps the two buttons for:

- a text input with the label "Your name", placeholder "Optional", max length 50, focused;
- the meta line "Shown to everyone in your groups. You can change it later in Settings.";
- an `inverted` button "Create passkey" (key icon) that starts registration with the trimmed name;
- a ghost "Back" text button that returns to the two original buttons.

An empty or blank name is sent as no name. The rest of the flow (cancelled, error, success) is
unchanged.

Tap count for joining as a new user: 1 → 2 taps plus optional typing, before the OS passkey prompt.

## Backend

### Rename (context `user`)

- Contract in `@ardoise/shared`: `userNameSchema = z.string().trim().min(1).max(50)`, reused by the
  rename body and by registration. `PATCH /me` with `{ name }`, returns the updated `MeResponse`.
- `application/rename-user.use-case.ts`: thin conductor. Updates the name of the session's user, then
  publishes a realtime event for each group the user is a member of. A single write, so there is no unit of work.
  The fan-out is in the use case, not in the domain. Who must hear about a rename is orchestration,
  not a business rule about users.
- Validation lives in the Zod contract and nowhere else: a name is any trimmed string of length 1 to 50,
  and there is no invariant beyond that for a domain function to protect.
- `UserRepository` gains `rename(id, name)`. The controller sits next to `GET /me`, in the auth
  controller, if that is where `/me` lives. Otherwise it goes in a `user` controller. That is the
  builder's call, as long as the use case stays in `user/application`.

### Realtime

- New group event `member.renamed { groupId, userId }`, published once per group of the renamed user.
- The group page refetches members on it, as it does on `member.joined`. Home ignores it, because home
  shows no member names.
- Feeds and details resolve names through the member list, so they follow once the list is refetched.
  If a screen holds names elsewhere, the builder wires it the same way.

### Registration

- `completeRegistrationRequestSchema` gains `name: userNameSchema.optional()`.
- `complete-registration.use-case.ts` uses `input.name ?? \`user-${uuid}\``.
- `AuthService.register(inviteToken, name?)` passes it through.

## Tests

Following `docs/testing.md`:

- **Backend e2e** (`test/`): rename succeeds and `GET /me` returns the new name; the name is trimmed;
  blank and over-50 names are rejected with 400 and nothing changed; unauthenticated gets 401;
  members of each of my groups receive `member.renamed`. Registration with a name stores it, and
  without one still gives `user-…`.
- **Frontend specs**: name sheet (Save disabled on empty or unchanged, error keeps value, success closes
  and updates the row), sign-out sheet error, version footer (`dev` fallback, sha shortening),
  accept-invite name step (Back returns, blank name sent as none).
- **Playwright** (`apps/e2e/e2e/`): "change my name" (the new name shows in a group's member list),
  "sign out" (confirm → login screen, home now redirects to login), "join a group with my name".
- **Screenshots**: settings, name sheet (filled, error), sign-out sheet, accept-invite name step, in
  light and dark.
- `apps/backend/scripts/seed-dev.ts`: give the dev users readable names if they don't have them yet,
  so the screenshots and the preview show the Name row with a real value.

## Decided by the owner

- Settings entry from home, one screen for name, theme, sign out and version.
- Name edited in a row that opens a sheet (variant A), not inline.
- Sign out asks for confirmation.
- Theme: System / Light / Dark, System by default.
- The name is global (`User.name`), not per group.
- Name can be typed when joining as a new user, optional, default stays `user-<uuid>`.

## My calls

- Max length 50, trimmed.
- Theme stays per device.
- Gear icon visible to every user, placed after the admin shield.
- `member.renamed` fanned out per group, rather than a new user-scoped event type.
- `Version dev` when `/version.json` is missing or says `dev`.
- The accept-invite name step replaces the two buttons in place, rather than opening a sheet.

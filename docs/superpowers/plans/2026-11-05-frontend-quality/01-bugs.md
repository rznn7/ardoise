# 01 Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Joining by invite never fails silently, retry replays the action that failed, and no subscription anywhere ignores its error by accident.

**Architecture:** `AcceptInvite` remembers its last attempt and every attempt goes through one path that maps errors to `cancelled` or `error`. This stays in the component: it is screen state (which button retries what), not a rule of the domain. Then `rxjs-x/no-ignored-error` finds every other `subscribe` without an error handler, and each gets an explicit decision.

The details-page subscriptions that outlive the page (finding 03) are fixed by plan 03, which rewrites that loading. Fixing them here would be thrown away.

**Tech Stack:** Angular 22, RxJS 7, vitest + Testing Library, `eslint-plugin-rxjs-x` 1.0.6 (peer: ESLint ^10.0.1, TypeScript <6.1; repo has 10.13 and 6.0.3).

**Spec:** `README.md` finding 01

## Global Constraints

- Copy is unchanged: `invite.accept.cancelled` ("Passkey not completed — tap to try again") and `invite.accept.failed` ("Something went wrong joining {group}.").
- Passkey cancellation is `DOMException` with `name === 'NotAllowedError'` (existing `isPasskeyCancellation`).
- `SUCCESS_DISPLAY_MS` stays 800.

## Review Focus

1. Registration cancelled, then retried: the retry must register again with the same name, not log in. Pinned in Task 1.
2. Login succeeds but consuming the invite fails (link used up meanwhile): today nothing happens. Pinned in Task 1.
3. Leaving the screen during the 800 ms success pause: no navigation to `/home` afterwards. Pinned in Task 1.
4. A background refresh failing after the lint fix: the screen keeps its data, no new toast. Each `error: () => undefined` added in Task 2 must be on a background path only.

---

### Task 1: AcceptInvite failures and retry

**Files:**
- Modify: `apps/frontend/src/app/invite-link/accept-invite/accept-invite.ts`
- Modify: `apps/frontend/src/app/invite-link/accept-invite/accept-invite.html` (the `error` and `cancelled` cases)
- Test: `apps/frontend/src/app/invite-link/accept-invite/accept-invite.spec.ts`

**Interfaces:**
- Produces: `AcceptInvite.retry(): void`, which replays the last of `joinLoggedIn`, `loginThenJoin`, `registerThenJoin` with its original arguments.

- [ ] **Step 1: Write the failing tests**

Reuse the spec's `renderLoggedOut()` helper and its fakes.

```ts
it('offers to retry registering when the passkey is dismissed', async () => {
  registerThenJoin.mockReturnValueOnce(throwError(() => new DOMException('', 'NotAllowedError')));
  // open naming, type "Ana", submit
  expect(await screen.findByRole('button', { name: /passkey not completed/i })).toBeVisible();
  registerThenJoin.mockReturnValueOnce(of(undefined));
  await user.click(screen.getByRole('button', { name: /passkey not completed/i }));
  expect(registerThenJoin).toHaveBeenLastCalledWith('x', 'Ana');
  expect(loginThenJoin).not.toHaveBeenCalled();
});

it('shows the failure when registering fails', async () => {
  registerThenJoin.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
  // submit the naming form
  expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong joining/i);
});

it('shows the failure and retries the login when joining after login fails', async () => {
  loginThenJoin.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 410 })));
  // click "Log in to join"
  expect(await screen.findByRole('alert')).toBeVisible();
  await user.click(screen.getByRole('button', { name: /retry/i }));
  expect(loginThenJoin).toHaveBeenCalledTimes(2);
});

it('does not leave for home once the screen is gone', async () => {
  vi.useFakeTimers();
  // join successfully, then fixture.destroy()
  vi.advanceTimersByTime(800);
  expect(router.navigate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @ardoise/frontend test -- accept-invite`
Expected: the four new tests FAIL (no alert after a register error, retry calls the wrong flow, navigation after destroy).

- [ ] **Step 3: Implement**

In `AcceptInvite`: a private `lastAttempt: (() => void) | null`; each public action sets it to a closure replaying itself, then runs a private `attempt(join: Observable<unknown>, onJoined: () => void)` that subscribes with `takeUntilDestroyed(this.destroyRef)`, sets `cancelled` on passkey cancellation and `error` otherwise. `retry()` calls `lastAttempt`. The success pause becomes `timer(SUCCESS_DISPLAY_MS).pipe(takeUntilDestroyed(this.destroyRef))`. In the template, the `error` and `cancelled` buttons call `retry()`. Delete the JSDoc on `token`.

- [ ] **Step 4: Run the spec and typecheck**

Run: `pnpm --filter @ardoise/frontend test -- accept-invite && pnpm --filter @ardoise/frontend typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/invite-link/accept-invite
git commit -m "Invite join failures show and retry the action that failed"
```

### Task 2: No ignored subscription errors

**Files:**
- Modify: `apps/frontend/package.json` (devDependency `eslint-plugin-rxjs-x@^1.0.6`)
- Modify: `apps/frontend/eslint.config.js`
- Modify: every file the rule flags

- [ ] **Step 1: Install and enable**

`pnpm --filter @ardoise/frontend add -D eslint-plugin-rxjs-x@^1.0.6`. In `eslint.config.js`, add a block for `files: ['src/**/*.ts']`, `ignores: ['src/**/*.spec.ts', 'src/test-*.ts']`, with plugin `rxjs-x` and rule `'rxjs-x/no-ignored-error': 'error'`.

- [ ] **Step 2: Run lint and list the findings**

Run: `pnpm --filter @ardoise/frontend exec eslint src`
Expected: errors on each `subscribe` without an error handler, including single-callback `subscribe(fn)` calls (`Settings` constructor, `RealtimeService` constructor, `VersionWatcher.start`, `AcceptInvite.registerThenJoin` if Task 1 missed it).

- [ ] **Step 3: Give each finding a decision**

- Action the user triggered (save, rename, revoke, join, sign out): show the failure the way the screen already does for its sibling actions (state or toast via the existing translation key).
- Background refresh or revalidation where the screen keeps its last data: `error: () => undefined`.
- Infinite sources that cannot error (`fromEvent`, `Subject` streams, `router.events`): `error: () => undefined`.

Write the decision for each file in the PR description, one line each.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend typecheck && pnpm --filter @ardoise/frontend test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend pnpm-lock.yaml
git commit -m "Lint rejects subscriptions that ignore their errors"
```

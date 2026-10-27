# Test strategy alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing specs in line with `docs/testing.md` (PR #30), and amend the document where the audit showed the rule was wrong rather than the tests.

**Architecture:** No production behavior changes except moving three formatters out of components into pure functions. Everything else is test code and `docs/testing.md`.

**Tech Stack:** vitest (backend e2e with testcontainers, frontend with Angular TestBed + Testing Library), Playwright.

**Spec:** `docs/testing.md` on `chore/test-strategy` (PR #30). Audit done on `main` at 1ea2f56.

## Global Constraints

- Commit messages: one line, no body, no trailers.
- No code comments.
- `pnpm typecheck` before calling a task done; `pnpm verify` green before the PR.
- Nothing Docker-churning alongside Playwright.
- A removed test is removed only when another layer catches the same bug: prove it by mutation (break the code, watch the remaining layer fail), or move the assertion first.

## Review Focus

- A refusal that still writes: the new "nothing changed" checks must fail when the use case writes before checking membership.
- A deleted mapper spec whose field no e2e asserts (`webauthnUserId` dropped from `/me`, a `null` nickname).
- A formatter moved out of a component that renders differently (locale, weekday, separator).
- A loading state asserted by role that the skeleton does not expose.
- A layout invariant (FAB size, long-name wrap) lost with its feature-spec class assertion and owned by no building block.

---

### Task 1: Rebase PR #30 on main and amend the strategy

**Files:**
- Modify: `apps/e2e/e2e/fixtures/db.ts` (conflict: keep both `seedPayments` from #32 and the helper from #30)
- Modify: `apps/frontend/angular.json` (conflict: keep `setupFiles` from #32 and the coverage options from #30)
- Modify: `docs/testing.md`, `CLAUDE.md` (Testing section)

- [ ] Merge `origin/main` into `chore/test-strategy` (merge, not rebase: the branch is already pushed), resolve the two conflicts by keeping both sides.
- [ ] `docs/testing.md`, "Where an assertion goes": replace the "Not: a component spec that replays a main path a scenario already covers" line with: overlap between a scenario and a component spec is fine, they guard different things (a scenario guards the use case end to end, a component spec guards a screen state); what to avoid is the same detail asserted in both (exact formatted text, a computed amount) and a scenario for an edge case a faster layer proves.
- [ ] `docs/testing.md`, "Signs of over-testing": the first bullet becomes "the same detail asserted in several layers" (not "the same behavior").
- [ ] `docs/testing.md`, "Layers" table, Frontend components row, Faked column: "the API services, or a store that has its own spec". Page specs fake `FeedStore`/`DoneStore` today (group page, payment details, options step, settlement details) and the stores have their own specs; rewriting the page specs over a real store is not worth it.
- [ ] `docs/testing.md`, after "Assertions go through roles and visible text, never CSS classes": a building block in `shared/ui` may assert the classes it promises (its visual contract); a feature spec never does, a layout bug in a feature is caught by the screenshot matrix.
- [ ] Update the Playwright figure ("today about … for N scenarios") from the merged CI run.
- [ ] Mirror the two rule changes in `CLAUDE.md` Testing bullets.
- [ ] `pnpm verify`, commit `docs(testing): overlap with scenarios is fine, building blocks own their classes, stores may be faked`, push.

### Task 2: Backend refusals check that nothing changed

**Files:**
- Modify: `apps/backend/test/create-payment.e2e-spec.ts` (`returns 403 when the caller is not a member of the group`, `returns 403 when the groupId does not exist`)
- Modify: `apps/backend/test/record-settlement.e2e-spec.ts` (`refuses a member who is neither side`, `refuses a caller outside the group`, `refuses members of another group`)
- Modify: `apps/backend/test/undo-settlement.e2e-spec.ts` (`refuses a caller outside the group`)

- [ ] Each test above gains a final assertion: no `payment` row (create), no `settlement` row (record), `remaining()` is 1 (undo). Reuse the file's existing row-count helper, or add one in the file in the style of `remaining()`.
- [ ] Mutation: in `CreatePaymentUseCase`, `RecordSettlementUseCase` and `UndoSettlementUseCase`, move the membership check after the write; each new assertion fails. Restore.
- [ ] `pnpm --filter @ardoise/backend test:e2e`, commit `test(backend): refused writes leave payments and repayments untouched`.

### Task 3: Drop the infrastructure mapper specs

**Files:**
- Delete: `apps/backend/src/{expense-group,member,payment,payment-share,user}/infrastructure/*.mapper.spec.ts`

They are not domain logic (CLAUDE.md: unit specs only for pure domain) and every HTTP e2e already asserts the response shapes.

- [ ] For each mapper, mutate it (rename a field, drop `toISOString`, leak `webauthnUserId`, turn a `null` nickname into `''`) and run backend e2e. Every mutation must fail at least one e2e. A mutation no e2e catches: add that assertion to the e2e spec of the matching endpoint before deleting.
- [ ] Delete the five specs. `pnpm --filter @ardoise/backend test` and `test:e2e`, commit `test(backend): mapper shapes are proven over HTTP, drop their unit specs`.

### Task 4: Formatters out of components

**Files:**
- Create: `apps/frontend/src/app/shared/format/short-day.ts` + spec: `shortDay(iso: string): string`, `en-GB`, `{ weekday: 'short', day: 'numeric', month: 'short' }` → `'Sun 25 Oct'`. Replaces `paidOn` (`payment-details.ts:77`) and `settledOn` (`settlement-details.ts:52`).
- Create: `apps/frontend/src/app/admin/admin-group/group-meta.ts` + spec: `groupMeta(group: AdminGroupDetail['group']): string` → `'EUR · created 1 Oct · 31 payments · €1,240.00 spent'`, singular `'1 payment'`. Extracted from `admin-group.ts:68-79`.
- Modify: the three components and their specs.

- [ ] Write the two function specs first (the values above, the singular, a non-EUR currency); watch them fail; extract; watch them pass.
- [ ] Component specs keep one assertion that the meta line is shown, built with the function (`screen.getByText(groupMeta(detail.group))`), instead of re-enumerating formats (`payment-details.spec.ts:139-187`, `settlement-details.spec.ts:89`, `admin-group.spec.ts:109`).
- [ ] `pnpm --filter @ardoise/frontend test`, typecheck, commit `refactor(frontend): day and admin group meta formatting are pure functions`.

### Task 5: Feature specs stop asserting CSS classes and tags

Per the Task 1 rule. Each line: where, what replaces it.

- `home.spec.ts:181-182`, `group-page.spec.ts:522-523` (FAB `h-14`, `min-w-14`): delete; the size belongs to `hlmBtn size="fab"`. If no spec owns it, add one to the FAB's building block (`shared/ui` or the button variant) asserting the classes once.
- `group-balances.spec.ts:139-153` (`w-24`, `justify-end`, `flex-1`, `min-w-0`, `truncate`): delete; the row layout belongs to `list-row` / `balance-indicator`, whose specs already assert their classes. Check that one of them covers truncation, else add it there.
- `accept-invite.spec.ts:160-162` (`whitespace-normal`, `break-words`): delete; covered by the screenshot matrix long-name cell. If no such cell exists, add one.
- `login.spec.ts:34,42` (button classList): replace with what the class meant (read the test; likely a variant that the screenshot shows), or delete.
- `options-step.spec.ts:294-305` (`.text-destructive`, `text-xs`): assert the error through text/role (the over/under-total message, `appError`) instead.
- `group-page.spec.ts:482-494` (shell `safe-area-inset-top`): the `bleed` contract belongs to `mobile-shell.spec.ts`; keep only that the hero shows.
- Skeleton/spinner presence (`home.spec.ts:105-106,122`, `group-page.spec.ts:501`, `payment-details.spec.ts:359`): assert the loading state by role. If the skeleton exposes none, give `page-state`'s loading state `role="status"` + `aria-label="Loading"` in the building block (and its spec), then use it.
- `app.spec.ts` (router outlet, create), `auth-layout.spec.ts` structure: framework wiring, delete. Keep `hosts the variant toggle in dev builds` only if it guards a real rule (dev only); assert it by its accessible name.

- [ ] One commit per building block touched, then one for the feature specs: `test(frontend): feature specs assert roles and text, building blocks own their classes`.
- [ ] Screenshot matrix: run it, check the long-name and FAB cells exist and look right.
- [ ] `pnpm verify`, push, open the PR (base: `chore/test-strategy` if #30 is not merged yet, else `main`).

## Not in this plan

- Pruning Playwright scenarios that overlap component specs (e.g. split by shares, unknown vs expired invite link): overlap is fine per Task 1; the suite is ~32 scenarios, far under the 5 minute budget.
- Rewriting page specs over real stores (see Task 1, Faked column).
- Raising the backend domain coverage figure: not a target.

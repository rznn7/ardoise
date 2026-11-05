# Frontend quality pass

A review of `apps/frontend` (2026-11-05, on `amount-entry`) found a sound architecture with drifting
details: the same problem solved several times in slightly different ways, never pulled into a shared
abstraction. This folder is the spec those plans argue from, one plan per finding, and the guardrails
that keep each finding from coming back.

Start after `amount-entry` is merged. One branch and one PR per plan, off `main`, in the order below.
Every plan except 01 is a refactor: no change a user can see, `pnpm verify` green, Playwright scenarios
untouched.

## Findings

| # | Finding | Evidence |
|---|---|---|
| 01 | Real bugs: failures swallowed or leaking past a component's life | `AcceptInvite.registerThenJoin` has no error handler; `loginThenJoin` drops every error but cancellation; retry buttons replay the wrong action; `setTimeout` navigates after leaving |
| 02 | Group context (`group`, `members`, `me`) fetched in 5 places; "my member" lookup written 11 times | `forkJoin({ group, members, me })` in `GroupPage`, `paymentFlowGuard` (×2), `PaymentDetails`, `SettlementDetails`; `isNotAccessible` copied 3 times |
| 03 | Data loading hand-rolled: `effect` + `untracked` + `subscribe` + `latestLoad` counter | 9 effects, 7 counters; `PaymentDetails.load` outlives the page and can navigate after the user left |
| 04 | Stores return signals from parameterised methods, forcing signal-of-signal in components | `computed(() => this.feedOfGroup()())` ×6 in `GroupPage`, ×1 in `PaymentDetails` |
| 05 | Effects used as edge detectors to coordinate stores | `lastSettled` in `GroupPage`, `hadPendingUpdate` in `PaymentDetails` |
| 06 | `FeedStore` bookkeeping sprawl; `PagedList` concerns leaking into stores | 11 parallel structures; `fetchSettled` copied in `DoneStore` with unbounded retry; immutable set/map updates written ~10 times; `withUpdate` copied; `createdByMemberId: 0` |
| 07 | `PaymentDraft` is open state | 15 public `WritableSignal`s written by guard and components; init in several calls; `toRequest` turns missing payer/amount into `0`; `reset` lists every field |
| 08 | Payment flow navigation by hard-coded history depth and hand-built URLs | `historyGo(-2)`, `historyGo(-3)`, `historyGo(-1)`; 13 `` `/group/${...}` `` literals |
| 09 | `GroupPage` does everything | 449 lines, 15 injects, 274-line template, 932-line spec |
| 10 | Templates: borrowed i18n keys, copied round icon buttons, copied "amount or dash" | `settings.back` ×9 outside settings, `settings.signOut.cancel` ×5, `invite.panel.done` ×2; `size-11 shrink-0 rounded-full` ×14 |
| 11 | Small duplication and noise | toggle value normalisation ×5, storage try/catch ×5, toast+translate ×5, `OnPush` ×15 (default in Angular 22), JSDoc |

## Order

Run them in number order. The "needs" column says what can move if priorities change.

| Plan | Needs |
|---|---|
| 00 guardrails baseline | |
| 01 bugs | 00 |
| 02 group context store | 00 |
| 03 resource loading | 01, 02 |
| 04 store reads | 00 |
| 05 store coordination | 03, 04 |
| 06 feed store | 02, 05 |
| 07 payment draft | 02 |
| 08 payment flow navigation | 07 |
| 09 group page split | 02, 04, 05 |
| 10 templates | 09 |
| 11 small stuff | 00 (its `jscpd` task last of all) |

## Guardrails

The owner skips line-by-line review, so prevention has to be automatic or loaded at the right moment.
What each layer is for:

- **Lint, built-in rules only** (`no-restricted-syntax`, `no-restricted-globals`) for anything a
  selector can see: it fails CI, costs no context. No custom ESLint plugin.
- **One off-the-shelf plugin**, `eslint-plugin-rxjs-x`, for `no-ignored-error`: it needs type
  information, which the frontend lint already has (`projectService: true`).
- **`apps/frontend/CLAUDE.md`** for judgement rules a selector cannot express. Claude Code loads a nested
  `CLAUDE.md` only when it reads files under that folder, so backend sessions pay nothing. Keep it short:
  one line per rule, the story stays in these plans.
- **`/simplify` before every PR**, one line in the root workflow: it reviews the branch diff for reuse and
  duplication, the class of problem behind most findings here.
- **`jscpd` in `lint`** as the last net for copy-paste across files.
- **How to write the lint restrictions:** ESLint does not merge a rule's options across config blocks;
  the last matching block wins. So each restriction is a named constant at the top of
  `eslint.config.js` (`const NO_EFFECT_IN_FEATURES = { selector, message }`), and each block lists the
  constants that apply to its files. Every new selector is proven once by adding a violating line,
  seeing the message, and removing it.
- **No TypeScript flag** addresses these findings (`strict` and `noUncheckedIndexedAccess` are on).
  **No new skill**: a skill loads on demand or by description match, which is less reliable than a
  nested `CLAUDE.md` for "every time you touch the frontend".

| Finding | Lint | `apps/frontend/CLAUDE.md` |
|---|---|---|
| 01 ignored errors | `rxjs-x/no-ignored-error` | subscriptions that can outlive the component |
| 02 duplicated context, status checks | `instanceof HttpErrorResponse` only in `shared/http-status.ts` | use `GroupContextStore`, `findMyMember` |
| 03 hand-rolled loading | `effect` banned in feature code (lands in 09) | load with `rxResource` / `loadStateOf` |
| 04 signal-of-signal | method returning `Signal` with parameters, in stores and services | plain reads |
| 05 effects as detectors | same `effect` ban | coordination in stores |
| 06 collection updates | | use `shared/collections.ts` |
| 07 open state | public `signal()` field in stores, services, drafts | readonly signals + intent methods |
| 08 history depth, URL literals | `historyGo` outside `shared/navigation`; `` `/group/` `` template literals outside `urls.ts` | |
| 09 god component | `jscpd` | |
| 10 borrowed i18n keys | `scripts/check-i18n-scope.ts` in `lint` | shared wording goes to `common.*` |
| 11 noise | `ChangeDetectionStrategy`; `localStorage`/`sessionStorage` globals outside `shared/storage.ts` | |

## Shared constraints

- No comments in code; rationale lives here. Commit messages are one line.
- `pnpm verify` green at the end of each plan; run `pnpm --filter @ardoise/frontend typecheck` after each
  task (vitest and lint do not report type errors).
- Specs move with the code they test; a deleted assertion needs a reason in the PR.
- Assert through roles and text, never CSS classes.
- Where a plan places logic, it says why it lives in that layer (owner is learning hexagonal
  architecture): pure functions are the frontend's domain, stores are its application layer,
  components are adapters to the DOM.

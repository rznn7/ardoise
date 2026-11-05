# 09 Group Page Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GroupPage` composes instead of doing everything: the feed list is its own component, day grouping is a pure function, and the page's last effects become event handlers, after which lint bans `effect` in feature code.

**Architecture:** After plans 02 to 05, `GroupPage` still renders the whole feed (days, two row kinds, payer names, repayment labels) and keeps two effects: one opens the group when the `groupId` input changes, one waits for a pull-to-refresh to settle to toast a failure. The feed list becomes a presentational component in the feed context (inputs in, outputs out). Grouping rows by day is a pure rule next to it. Opening reacts to the route's `paramMap`, which is the event that actually happens. The refresh toast waits on the `refreshing` signal through `toObservable`, scoped to the refresh that started it.

**Tech Stack:** Angular 22, RxJS 7, vitest + Testing Library.

**Spec:** `README.md` finding 09

## Global Constraints

- Templates follow `docs/design.md` (helm components, text directives, no arbitrary values).
- Day labels: "Today", "Yesterday", else `weekday short, day numeric, month short` in the active locale (`dayLabel`).
- Targets after this plan: `group-page.ts` under 250 lines, `group-page.html` under 160.

## Review Focus

1. Two consecutive days with rows interleaved by pending items: one section per label, in order. Pinned in Task 1.
2. Navigating from group 1 to group 2 without leaving the page (component reused): group 2 opens. Pinned in Task 3.
3. Pull-to-refresh where the feed fails and balances succeed: one error toast once everything settled. Existing spec; check it passes.
4. Pull-to-refresh answered entirely from cache (nothing ever loads): no toast and no hanging subscription after leaving. Pinned in Task 3.

---

### Task 1: `groupByDay`

**Files:**
- Create: `apps/frontend/src/app/feed/feed-days.ts`, `feed-days.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface FeedDay { readonly label: string; readonly rows: readonly FeedRow[] }
export const rowDate: (row: FeedRow) => string;          // paidAt or settledAt
export const rowKey: (row: FeedRow) => string;           // 'payment:5' / 'settlement:3', for @for track
export function groupByDay(rows: readonly FeedRow[], today: Date, tr: Translator): readonly FeedDay[];
```

- [ ] **Step 1: Spec** with today = 2026-11-05 and an `en` translator: rows on 11-05, 11-05, 11-04, 11-01 → labels `['Today', 'Yesterday', 'Sun, Nov 1']` with 2, 1, 1 rows; empty input → `[]`.
- [ ] **Step 2: Run, see it fail, implement (moved from `GroupPage.days`), see it pass, commit**

Run: `pnpm --filter @ardoise/frontend test -- feed-days`

```bash
git commit -m "Feed rows grouped by day in a pure function"
```

### Task 2: `FeedList` component

**Files:**
- Create: `apps/frontend/src/app/feed/feed-list/feed-list.ts`, `feed-list.html`, `feed-list.spec.ts`
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `group-page.html`, `group-page.spec.ts`

**Interfaces:**
- Consumes: `groupByDay`, `rowKey` (Task 1), `settlementLabel`, `findMyMember`.
- Produces: `<app-feed-list [rows] [more] [currency] [members] [meUserId] (loadMore) (retryMore) />` with `rows: readonly FeedRow[]`, `more: More`, `currency: string`, `members: readonly GroupMember[]`, `meUserId: number`. One `@for` over rows, one `<li>` template whose link, title, meta and amount depend on the kind. The empty state stays in `GroupPage` (it depends on `isModerator`).

- [ ] **Step 1: Move the group-page spec cases about row rendering into `feed-list.spec.ts`**: payer name and "You", "Someone" for an unknown payer, "Saving…" and no link on pending rows, repayment label, amounts. Render `FeedList` directly with literal inputs.
- [ ] **Step 2: Run, see them fail, implement, see them pass**

Run: `pnpm --filter @ardoise/frontend test -- feed-list group-page`

- [ ] **Step 3: `GroupPage` uses `<app-feed-list>`; delete `days`, `payerNames`, `repaymentLabel`, `FeedDay`; typecheck; commit**

```bash
git commit -m "Feed list component out of the group page"
```

### Task 3: No effects left in feature code

**Files:**
- Modify: `apps/frontend/src/app/expense-group/group-page/group-page.ts`, `group-page.spec.ts`
- Modify: `apps/frontend/eslint.config.js`

- [ ] **Step 1: Failing test** `opens the new group when the route changes`: render at `/group/1`, navigate to `/group/2` → `GroupContextStore.ensure(2)` called and the heading shows group 2's name.
- [ ] **Step 2: Replace the opening effect** with `inject(ActivatedRoute).paramMap` → `Number(groupId)` → `distinctUntilChanged()` → `takeUntilDestroyed()` → `open(id)`.
- [ ] **Step 3: Replace the refresh effect**: `refresh()` subscribes once to `toObservable(this.refreshing, { injector })` piped through `skipWhile((r) => !r)`, `first((r) => !r)`, `takeUntilDestroyed(this.destroyRef)`, then toasts `group.refreshFailed` when any refresh state is `'error'`. Delete `refreshRequested`; `refreshing` is true while any of the refresh states is loading.
- [ ] **Step 4: Lint ban**: in a block for `src/app/**/*.ts` ignoring `src/app/shared/**` and specs (carry the block's other selectors):

```js
{
  selector: "CallExpression[callee.name='effect']",
  message: 'effect is a last resort (apps/frontend/CLAUDE.md): rxResource to load, computed/linkedSignal to derive, react to events where they happen.',
}
```

Run `grep -rn "effect(" apps/frontend/src/app --include=*.ts | grep -v spec | grep -v /shared/` and expect nothing.

- [ ] **Step 5: Append to `apps/frontend/CLAUDE.md` under `## Signals and effects`**

```markdown
- Lint rejects `effect` outside `src/app/shared`. A genuine case (pushing state into a browser API) becomes a shared building block or service; no `eslint-disable`.
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm verify`

```bash
git commit -m "Group page reacts to route and refresh events; lint bans effects in features"
```

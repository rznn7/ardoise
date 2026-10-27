# Feed pagination

The Feed pagination slice in `docs/roadmap.md`: the group feed and the Done repayments arrive in
pages of 50, and the next page loads on its own when you reach the bottom.

## Why

No group is large yet. The owner wants this handled ahead of time, for performance: today
`GET /expense-groups/:groupId/feed` returns the whole history of a group, payments and repayments,
and the group page renders all of it. A flatshare running for two years would load thousands of
rows on every open. The same holds for repayments: a long-lived group piles them up, and the owner
asked that they be paginated too.

## Goals

- Opening a group loads at most 50 feed rows, whatever the size of its history.
- Scrolling to the bottom of the feed loads the next 50 with no tap. The same for the Done
  section of the Balances tab.
- The Done section can still reach every repayment of the group (the owner: "tous"), page by page.
- Balances, the hero figure and the suggested repayments stay exact, whatever is loaded: they are
  computed by the server over the whole history, as today.
- Coming back from a payment or repayment details screen puts you where you were: the same rows
  loaded, the same scroll position, the same tab. Nothing is refetched on the way back (the owner:
  if you are far down, you would not see a new item anyway).
- Pulling down at the top of the group page refreshes it (the owner's idea).

## Non-goals

- Real-time updates (SSE slice). A page already loaded is not refreshed when someone else adds a
  payment; pull to refresh, or opening the group again from home, shows it.
- Jumping to a date, search, filters.
- Paginating the home group list, the members, the admin lists.
- Virtualising the DOM (rendering only visible rows). Pages of 50 keep the DOM small enough for
  the sizes we expect.

## Anti-goals

- A balance on screen that depends on how many pages are loaded.
- A repayment missing from Done because the feed page holding it isn't loaded.
- A row shown twice or skipped at a page boundary, including when two items share the same date.
- A "Load more" button. The owner picked automatic loading.

## Domain rules

- **Order** stays the feed's current one, in `apps/backend/src/feed/domain/feed.ts`: newest date
  first, then payments before repayments at the same instant, then highest id first. Repayments
  alone sort by `settledAt` then id, the same way.
- **Cursor**: the position of the last item of a page, `(date, kind, id)` for the feed and
  `(date, id)` for repayments. The next page is every item strictly after it in that order. A
  cursor is opaque to the client: an encoded string it passes back unchanged (encoding is the
  builder's call). An invalid cursor is a 400.
- **Page size**: 50, fixed by the server (my call: no `limit` parameter until something needs
  it). Each page says whether more follow (`nextCursor`, or `null` at the end).
- Building and comparing cursors is a pure rule: it lives in `feed/domain` with unit specs on the
  ties (same date, payment and repayment at the same instant, same date and kind), not in SQL or in
  the controller. The repository translates it into a `WHERE` and a `LIMIT`.

## Backend

### Feed (`feed/`)

- `GET /expense-groups/:groupId/feed?cursor=…` returns
  `{ items: FeedItem[], nextCursor: string | null }`. Without a cursor, the first page. This
  changes the contract in `@ardoise/shared`; the frontend follows in the same PR.
- The repository reads at most 51 rows from each table after the cursor, ordered and limited in
  SQL, merges them with `newestFirst`, keeps the first 50, and reports whether more exist. It never
  loads the whole history.
- Membership check unchanged (403 `NotAMember`).
- An index on `(group_id, paid_at, id)` for payments and `(group_id, settled_at, id)` for
  settlements, through the schema and `db:generate`.

### Repayments of a group (`settlement/`)

- New `GET /expense-groups/:groupId/settlements?cursor=…`, same response shape with
  `SettlementResponse` items, newest first, 50 per page. Members only.
- It belongs to `settlement/` and not to `feed/`: the Done section lists repayments as repayments,
  not as a mix with payments.
- The cursor type and its rule are shared with the feed's where they coincide; the builder decides
  whether that is one function or two thin ones over a common comparison.

## Frontend

### Feed (Payments tab)

- The store keeps loaded pages for a group and the `nextCursor`. The group page shows the rows
  loaded so far, grouped under day headers as today.
- When the end of the list comes into view (an `IntersectionObserver` sentinel, or equivalent),
  the next page is requested. One request at a time per list; nothing when `nextCursor` is null.
- While the next page loads, a small loading indicator sits under the last row. If it fails, an
  inline error under the last row with a Retry; the rows already loaded stay.
- At the end of the history, nothing is added (my call: no "That's everything" line).
- Day headers: if a page ends in the middle of a day, the next page's first rows join that same
  day, without a second header.
- Optimistic add, edit, delete and undo keep working on the loaded rows, as today, including
  when they happen on a details screen: the loaded pages are kept in the store and updated there. A newly added
  payment lands at its date among loaded rows; if its date is older than everything loaded, it
  appears once that page is reached (my call).
- Empty states and `hasActivity` read the first page: if a group has any activity, the first page
  is non-empty.

### Keeping your place

- The store keeps a group's loaded pages (feed and Done) for the session. Coming back to the group
  page from one of its child routes (payment or repayment details, the payment form) renders
  them as they are, with no request, and restores the scroll position of the shell's scroll
  container (`<main>` in `mobile-shell`, not the window) and the selected tab.
- Opening the group from home (or by URL) is a fresh visit: first page, top of the list, Payments
  tab (my call: the place is kept for going back, not across visits). Balances are fetched as
  today.
- The places that reload today keep reloading, but only the first page, replacing the loaded
  pages: the reconcile after a mutation raced a load, and the error path of an undo (my call:
  rare, and correctness beats keeping the place there).

### Pull to refresh

- On the group page, pulling down while the list is at the top shows a spinner indicator and
  refetches: the group, its balances, the first page of the feed and the first page of Done. The
  loaded pages are replaced by the fresh first page.
- The shell's `<main>` has `overscroll-contain`, and an installed iOS PWA has no native
  pull-to-refresh, so the gesture is built in the app. It is a new building block in
  `src/app/shared/ui` (called out in the PR), reusable by the home list later; this slice uses it
  only on the group page (my call).
- While refreshing, the rows already shown stay; if the refresh fails, they stay and a toast says
  it could not refresh.
- A threshold before triggering, and the indicator follows the finger up to it; exact distance and
  look are the builder's, within `docs/design.md`. Screenshots of the pulled and refreshing states
  in light and dark.

### Done section (Balances tab)

- Fed by the new settlements endpoint, no longer by the feed rows.
- First page loads with the Balances tab; the next pages load automatically when the bottom of the
  Done section comes into view, with the same loading and error treatment as the feed.
- Done keeps today's behaviour (my call): a repayment still saving does not show in Done, it
  shows "Saving…" in the Repayments section; once saved it appears at the top of Done. Undo
  removes it from Done optimistically and restores it if refused. The feed and Done stay
  consistent with each other.

### Details screens

- Payment and repayment details, opened from a row or directly by URL, keep loading the item by
  id. They never depend on the item being in a loaded page.

## Dev seed

`apps/backend/scripts/seed-dev.ts` gets a group with more than 100 feed items and more than 50
repayments spread over months, so both lists load at least two extra pages.

## Tests

Per `docs/testing.md`:

- **Domain unit**: cursor ordering and the "strictly after" rule, ties included.
- **Backend HTTP e2e**: first page and `nextCursor`; walking every page returns each item exactly
  once in order, with ties at a page boundary; last page has `nextCursor: null`; invalid cursor
  400; non-member 403; the same for the settlements endpoint.
- **Frontend components**: next page requested when the sentinel shows, not twice in flight, not
  past the end; loading and error-with-retry under the list; a day split across pages has one
  header; Done fed by its own source.
- **Frontend components**, also: going back from details renders the kept pages with no request;
  pull to refresh replaces them with the first page; a failed refresh keeps the rows.
- **Playwright** (two scenarios): in a group with more than 50 payments, scrolling to the bottom
  shows the oldest payment, and opening it then going back keeps it in view; a payment added by
  another member shows after pulling to refresh.

## Left to the builder

- Cursor encoding, and whether the feed and settlements cursors share code.
- The loading indicator and inline error markup, within `docs/design.md`.
- How the store holds pages (one list with a cursor, or a list of pages).

# Real-time

The Real-time SSE slice in `docs/roadmap.md`: what other members do shows up on your screen
without a tap.

## Why

The owner: "ce qu'on veut ici c'est principalement une info très fiable". The moment it is for:
several members of a group enter their expenses of the day at the same time, and each of them must
see all of them, correctly, without pulling to refresh. Today a loaded page is only refreshed by
pull to refresh or by opening the group again from home (feed pagination slice, non-goal).

## Goals

- On the group page, a payment or repayment added, edited or deleted by someone else appears,
  changes or disappears in the loaded rows, and balances follow, with no tap.
- On home, the balance on each group row follows what happens in every group of mine, and a group
  I join or create on another device appears.
- A member joining a group shows in that group's member list.
- No event is silently lost: after a short drop of the connection the client catches up exactly;
  if it cannot, the page reloads.
- After a long time in the background (about 5 minutes hidden, my call), the page reloads. The
  owner: "si l'app est inactive longtemps on recharge la page simplement", and "si on part 5 min
  c'est qu'on a plus envie de faire ce que l'on faisait": an open payment form is lost too.
- Rows from others arrive quietly, as if they had always been there (the owner: "discrètement").

## Non-goals

- Animations for arriving rows. The owner: "on verra plus tard pour des animations smooth".
- Notifications, toasts or highlights announcing what someone else did.
- Conflict handling when two people edit the same payment: last save wins, as today. An open
  payment form is never touched by an incoming event (only a full reload, below, discards it).
- A connection status indicator.
- Several backend instances. Events are fanned out in memory in the single Nest process.
- Push notifications when the app is closed.

## Anti-goals

- A row shown twice, including my own payment while it is saving.
- A row missing after the connection dropped and came back.
- An event about a group reaching someone who is not a member of it.
- A balance on screen that disagrees with the rows after events settle.
- Losing my scroll position because someone else added a payment.

## Transport: SSE

Chosen with the owner over WebSockets and polling. Writes keep going through the existing REST
endpoints; the stream only tells clients that something changed, so a one-way server → client
channel is enough. SSE is plain HTTP: the session cookie and the guard work as on any route, and
`EventSource` reconnects on its own and sends back the last event id it saw (`Last-Event-ID`).

## Backend

### Events

One stream per signed-in user, not per group: `GET /events` (`text/event-stream`). It carries the
events of every group the user is a member of, so one connection serves home and the group page.

Events, each with the `groupId` it concerns:

| Event | Sent when | Payload |
|---|---|---|
| `payment.saved` | a payment is created or edited | the `PaymentResponse` |
| `payment.deleted` | a payment is deleted | `{ groupId, id }` |
| `settlement.saved` | a repayment is recorded | the `SettlementResponse` |
| `settlement.deleted` | a repayment is undone | `{ groupId, id }` |
| `member.joined` | someone joins through an invite link | the member, and the group summary |
| `group.created` | a group is created | the group summary (sent to its creator only) |
| `ready` | a connection opens | the current event id |
| `reset` | the server cannot replay what the client missed | none |

The payloads reuse the shapes of the existing contracts in `@ardoise/shared`; the event union is a
new Zod contract there.

`member.joined` goes to every member of the group, including the one who joined (so a group joined
on one device appears on home on another). `group.created` goes to the creator's other sessions.

### Who receives what

- An event about a group goes to every open stream of every member of that group, read at the time
  the event is sent (not cached at connection time, my call: membership changes, and a stale cache
  is exactly the leak the anti-goals forbid).
- Every connection receives every event it may see, the writer's own included (my call). Excluding
  the writer's session would hide a change from a second tab or the installed PWA sharing the same
  cookie, and would leave the writer unaware of a write whose REST response was lost after commit.
- To avoid a double row while saving, every write request carries a client-generated operation id
  in a header; the use case passes it into the event (`opId`). The client matches it to its pending
  row and replaces that row instead of adding a second one. Events from other clients have an
  `opId` the receiver does not know.
- The stream ends when its session is revoked, logged out or expires (the admin revoke included).
  Logout and revoke publish a "session ended" signal through a second port, which the realtime
  adapter listens to; the guard exposes the session id on the request so a stream knows its
  session.

### Reliability: ids, replay, reset

- Every event has an id, increasing across the whole process. The id also carries something that
  changes on each server start, so that an id from before a restart is recognisably foreign.
- The server keeps the most recent events in memory (size is the builder's call; enough to cover a
  minute or two of a busy instance).
- On every connection, the first message is a `ready` event carrying the current id, so a client
  knows from which point it is live.
- When a client reconnects with `Last-Event-ID`, the server sends, in order, every kept event after
  that id that this user may see, then goes live. If that id is not in the buffer (too old, or from
  before a restart), it sends `reset` instead and goes live.
- A comment line every ~25 seconds keeps idle connections open through proxies and lets the client
  notice a dead connection.

### Where the code goes (and why)

- Use cases publish an event **after** their write has committed: `CreatePaymentUseCase` runs its
  unit of work, then publishes `payment.saved`. Publishing is the application layer's job: it is
  orchestration ("once this is saved, tell others"), not a business rule, so it stays out of the
  pure domain functions like `createPayment`. Publishing after the commit, not inside the
  transaction, means a rolled-back write never sends an event.
- The publisher is a port: an interface and its DI token in a domain folder, with no Nest or RxJS
  in it. The use cases depend on that interface only.
- A new `realtime/` context holds the adapter: the in-memory publisher (fan-out, id counter, replay
  buffer), the SSE controller and its module. It is infrastructure because it is about delivery
  (HTTP streaming, memory), not about expenses.
- Concerned use cases: create, update, delete payment; record, undo settlement; consume invite
  link; create expense group; and logout and revoke session for the "session ended" signal.
- Delivery order: two concurrent writes can publish in the opposite order of their commits. The
  client keeps the ids of deleted items for the session, so a late `*.saved` never brings back a
  deleted row (ids are never reused). Two people editing the same payment within the same instant
  is the non-goal above: the last event received wins on screen (my call).

### Proxy

Caddy (`apps/frontend/Caddyfile`) flushes `text/event-stream` responses immediately, so no
buffering setting is expected; the builder checks it on the preview deploy. The Angular dev proxy
must pass the stream through too.

## Frontend

### Connection

- One `EventSource` on `/api/events`, opened once the user is signed in, closed on logout. A
  service in the app owns it and dispatches events to the stores.
- Startup gap: a screen can fetch before the stream is open, and a write committed in between
  would be in neither. On the first `ready` of the app, screens already loaded refetch their first
  page and merge it (my call), so nothing committed before the stream opened is missed.
- When the stream closes for good (`EventSource` stops retrying after a 401), the app checks the
  session; if it is gone, it goes to login as any other 401 does today.
- On `reset`: a full page reload, through the existing `PAGE_RELOAD` token
  (`shared/version/version-watcher.ts`), the same as a new deploy.
- When the app has been hidden (`visibilitychange`) for about 5 minutes or more, on coming back:
  the same full page reload, whatever screen is open, the payment form included. Under that, rely on `EventSource` reconnecting and
  the server replaying.

### Group page (feed, Done, balances, members)

- `payment.saved` / `settlement.saved`: the item is inserted or replaced by id among the loaded
  rows, at its date, through the store's existing `PagedList.patch`. If it sorts after the last
  loaded row (`boundary`) it is not shown; it appears when that page is reached, as the pagination
  slice already does for an old payment added locally.
- An edit that moves a payment's date below the loaded range makes it leave the loaded rows.
- `payment.deleted` / `settlement.deleted`: the row leaves the loaded rows, Done included.
- Repayments go to Done the same way, through `DoneStore`.
- Balances of that group are refetched after events (coalesced when several arrive together, my
  call), so the hero figure and suggested repayments always come from the server.
- `member.joined`: the member list of that group is refetched or updated.
- An event arriving while a page fetch is in flight must not be undone by that page's response.
  The feed store already guards local mutations against racing loads (`settledMutations`); events
  need the same guarantee (how is the builder's call).
- A pending local edit or delete on a row keeps its overlay when an event about that row arrives.
- The scroll position does not move because of an event.

### Details screens

- Payment or repayment details open on an item that gets `*.saved`: it shows the new values.
- Open on an item that gets `*.deleted`: go back to the group page with a toast, "This payment was
  deleted" / "This repayment was undone" (my call; copy follows `docs/design.md`).
- The payment form is never changed by an event; only the full reload above discards it.

### Home

- Any event about a group refetches the balances of my groups (`balanceApi.listMine`), coalesced.
- `member.joined` (when I am the one who joined) and `group.created` add the group row.

## Dev seed

No change: this slice stores nothing new (my call, against the usual rule that each slice updates
`seed-dev.ts`: there is no new state to show).

## Tests

Per `docs/testing.md`:

- **Backend unit**: the replay rule (events after an id, unknown or foreign id gives `reset`) if it
  ends up as a pure function.
- **Backend HTTP e2e**: a member's stream receives `payment.saved` after another member creates a
  payment; a non-member's stream receives nothing; the writer's own event carries its `opId`;
  reconnecting with `Last-Event-ID` replays exactly the missed events; an unknown id gives
  `reset`; no event after a refused write; the stream ends on session revoke and logout;
  unauthenticated is 401.
- **Frontend components**: an event inserts a row at its date, replaces by id, is ignored past the
  boundary, removes on delete; a late save after a delete does not bring the row back; no double
  row with a pending create (matched by `opId`); an event during an in-flight
  page fetch survives it; balances refetched once for a burst; `reset` and a long hidden period
  call `PAGE_RELOAD`, a short one does not; details screen leaves on delete with the toast.
- **Playwright** (two or three scenarios, two browser contexts as two members): a payment added by
  one member appears on the other's group page without refresh, and their balance changes; home of
  the other member follows; a payment deleted while the other has its details open sends them back
  with the message.

## Screens

The only new visible state is the toast on a details screen after a deletion by someone else.
Screenshots of it in light and dark.

## Left to the builder

- Event id format, buffer size, heartbeat interval.
- Whether the publisher port lives in `shared/` or per context.
- How the stores receive events (one dispatcher calling store methods, or each store subscribing).
- Coalescing delay for balance refetches.
- How the "survives an in-flight fetch" guarantee is implemented.

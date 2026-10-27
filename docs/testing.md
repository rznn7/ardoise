# Ardoise — Testing strategy

Each layer proves something the others cannot. Breadth lives in the fast layers; Playwright stays
thin so the full-stack suite never becomes the hour-long run nobody waits for.

## Layers

| Layer | Where | Real | Faked | Proves |
|---|---|---|---|---|
| Domain unit | `apps/backend/src/**/*.spec.ts`, `libs/shared` | everything | nothing | Pure rules: split rounding, link status, net balances, debt simplification |
| Backend HTTP e2e | `apps/backend/test/*.e2e-spec.ts` | HTTP, Nest, Zod validation, SQL, Postgres constraints, exception filters | the passkey verifier | The HTTP contract: status, body, rights, effect in the database |
| Frontend components | `apps/frontend/src/**/*.spec.ts` | Angular, router, DOM, signals | the API services, or a store that has its own spec | Screen states: loading, error, empty, optimistic update and rollback, form validation |
| Full-stack scenarios | `apps/e2e/e2e/*.spec.ts` | everything, WebAuthn through a virtual authenticator | nothing | A use case works end to end, with the text the browser really renders |
| Screenshot matrix | `apps/e2e/screenshots/` | the frontend | the API | Nothing automatically: review material for PRs, not a regression test |

The Zod contracts in `@ardoise/shared` are a static layer on top: a response shape change breaks
the frontend typecheck.

## Where an assertion goes

- **A pure rule** (a calculation, a status, a format) → a pure function, unit-tested with its edge
  cases. On the frontend too: date, amount and label formatting live in functions such as
  `admin-dates.ts` or `balance-rows.ts`, not inside a component spec.
- **A rule visible over HTTP** (who may call what, what is stored, which error code) → backend
  e2e. Authorization is tested by refusal *and* by checking nothing changed.
- **A screen state the backend cannot easily produce** (loading, 500, offline, rollback after a
  failed write, a race between requests) → component spec.
- **A use case** → one Playwright scenario for the main path, plus the failures that cross layers
  (a revoked link refused at join, a signed-out session). The text a user reads is asserted here,
  in the real browser and locale.
- **Overlap is fine** between a scenario and a component spec: they guard different things, the
  use case end to end and a screen state. What to avoid is the same detail asserted in both (an
  exact formatted text, a computed amount), and a scenario for an edge case a faster layer proves.
- **A faked store**: a page spec may fake a store that has its own spec. Assert what the page shows
  after the action rather than the call itself, when the fake allows it; the scenarios cover the
  real wiring.

Assertions go through roles and visible text, never CSS classes, in every layer that touches the
DOM. One exception: a building block in `shared/ui` may assert the classes it promises, since they
are its visual contract. A feature spec never does; a layout bug in a feature is caught by the
screenshot matrix.

## Playwright budget

- A slice adds about two to five scenarios, one per use case, not one per edge case.
- The suite stays under **5 minutes in CI** (today about 2 min 20 for 29 scenarios). When it gets
  close, pull one of these levers rather than dropping scenarios:
  - **injected session**: scenarios whose subject is not authentication start with a session
    seeded in the database and its cookie set, instead of signing up through the UI;
  - **parallel workers**: one database per worker, `workers` above 1.
- Nothing that starts or stops Docker containers runs alongside Playwright: Chrome aborts
  in-flight requests with `ERR_NETWORK_CHANGED`. The root `test:e2e` runs the suites one after
  the other.

## Coverage

CI publishes a coverage summary per layer in each job's summary page (lines, statements,
branches, functions, and the five least covered files):

- **Backend domain (unit)**: `src/**/domain`, ports excluded. A low figure points at domain
  logic only reached through HTTP tests.
- **Backend HTTP (e2e)**: all of `src`.
- **Frontend components**: `src/app`, the vendored helm library excluded.

Locally: `pnpm --filter @ardoise/backend test:cov`, `pnpm --filter @ardoise/backend test:e2e:cov`,
`pnpm --filter @ardoise/frontend test:cov`.

Coverage is not a target, and there is no threshold. It points at code that never runs and
should; it says nothing about whether a test would catch a bug. A test earns its place only by
catching a bug that no other layer catches. Do not write one to raise a figure: the domain
figure, for instance, is not a to-do list, since a rule already proven over HTTP gains nothing
from being isolated unless it has edge cases worth enumerating.

Signs of over-testing, to prune rather than add to:

- the same detail asserted in several layers;
- a test that breaks on a refactor with no bug behind it (asserting a method was called rather
  than what the user sees);
- a test of framework wiring, a getter, or what the types already guarantee.

Playwright has no code coverage. Its scenarios are named as use cases, and each slice's spec lists
the use cases its PR must cover; `pnpm --filter @ardoise/e2e exec playwright test --list` prints
them all.

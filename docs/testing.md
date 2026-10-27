# Ardoise — Testing strategy

Each layer proves something the others cannot. Breadth lives in the fast layers; Playwright stays
thin so the full-stack suite never becomes the hour-long run nobody waits for.

## Layers

| Layer | Where | Real | Faked | Proves |
|---|---|---|---|---|
| Domain unit | `apps/backend/src/**/*.spec.ts`, `libs/shared` | everything | nothing | Pure rules: split rounding, link status, net balances, debt simplification |
| Backend HTTP e2e | `apps/backend/test/*.e2e-spec.ts` | HTTP, Nest, Zod validation, SQL, Postgres constraints, exception filters | the passkey verifier | The HTTP contract: status, body, rights, effect in the database |
| Frontend components | `apps/frontend/src/**/*.spec.ts` | Angular, router, DOM, signals | the API services | Screen states: loading, error, empty, optimistic update and rollback, form validation |
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
- **Not**: a component spec that replays a main path a scenario already covers, or a scenario
  for an edge case a faster layer can prove.

Assertions go through roles and visible text, never CSS classes, in every layer that touches the
DOM.

## Playwright budget

- A slice adds about two to five scenarios, one per use case, not one per edge case.
- The suite stays under **5 minutes in CI** (today about 2 min 20 for 28 scenarios). When it gets
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
`pnpm --filter @ardoise/frontend test:cov`. There is no threshold: watch the trend. Coverage
says which code never runs, not whether a test would catch a bug in it.

Playwright has no code coverage; its coverage is the use case table below.

## Use cases

Every Playwright scenario appears here, and `pnpm --filter @ardoise/e2e lint` fails when a
scenario is missing from this table or a row names a scenario that does not exist. A row with
`—` is a known gap.

| Area | Use case | Scenario |
|---|---|---|
| Access | A visitor is sent to login | `a visitor without a session is sent to login` |
| Access | A member with a session skips login | `a member with a session skips the login page` |
| Access | Log out and back in | `a member logs out and back in with the same passkey and finds their groups` |
| Access | Install the app | `the app can be installed full screen with its icon` |
| Groups | Create a group and invite a friend | `a member creates a group and a friend joins it from the shared link` |
| Groups | Join with a new passkey | `a newcomer joins a group from an invite link with a new passkey` |
| Groups | An unknown invite link | `an unknown invite link explains itself instead of failing` |
| Groups | An expired invite link | `an expired invite link explains itself` |
| Groups | Open on the last group | `the app opens on the last group, and back returns to the list` |
| Groups | Back out of a group opened from its link | `a member backs out of a group opened from its link and stays in the app` |
| Groups | Invite people from an existing group | — |
| Payments | Add a payment with the defaults | `a member adds a payment with the defaults` |
| Payments | Add a payment split by shares | `a member adds a payment split by shares, leaving one member out` |
| Payments | Edit a payment | `a member edits a payment's payer` |
| Payments | Delete a payment | `a member deletes a payment` |
| Balances | Balance on the group list | `a member sees their balance on the group list` |
| Balances | What I owe in a group | `a member sees what they owe in a group` |
| Balances | Who repays whom | `a member sees who repays whom` |
| Balances | Balance follows a new payment | `the balance updates after adding a payment` |
| Repayments | Record that I paid someone back | `a member records that they paid someone back` |
| Repayments | Record that someone paid me back | `a member records that someone paid them back` |
| Repayments | Undo from the balances | `a member undoes a repayment from the balances` |
| Repayments | Undo from the details | `a member undoes a repayment from its details` |
| Repayments | A repayment between others is read only | `a repayment between two other members is read only` |
| Admin | See who is on the instance | `an admin sees who is on the instance` |
| Admin | See a user's groups | `an admin sees a user's groups` |
| Admin | Revoke an invite link | `an admin revokes an invite link` |
| Admin | Sign a user's session out | `an admin signs a user's session out` |
| Admin | A regular user has no admin panel | `a regular user has no admin panel` |

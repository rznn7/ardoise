# Ardoise

Shared expense splitter (Tricount-like). pnpm monorepo: Angular 22 frontend, NestJS 12 backend, Zod contracts shared between them. Drizzle + PostgreSQL, WebAuthn passkeys with an opaque session token in an `httpOnly` cookie, stored in the `session` table. Planned: SSE for real-time, Docker Compose deploy on a Hetzner VPS.

The owner is learning hexagonal architecture through this project. When you place logic, say why it lives in that layer.

## Layout

```
apps/backend    NestJS, hexagonal, one folder per bounded context
apps/frontend   Angular standalone components, spartan.ng helm UI in libs/ui, Tailwind 4
apps/e2e        Playwright: full-stack scenarios (e2e/) and the screenshot matrix (screenshots/)
libs/shared     Zod contracts (@ardoise/shared), consumed from src by tsc/vitest/Angular, from dist by the backend build
docs/           design.md (design system, UX, workflow), domain.md (entities, rules), testing.md (test strategy, coverage), roadmap.md (feature slices), superpowers/specs + plans
```

## Commands

Run from the root. Toolchain pinned in `mise.toml` (Node 24, pnpm 11).

```
pnpm dev                 shared watch + frontend (4200, /api proxied) + backend (3000, starts Postgres via docker compose)
pnpm verify              lint, typecheck, test, test:e2e, build: the CI gate
pnpm typecheck           tsc --noEmit everywhere
pnpm --filter @ardoise/backend test       pure domain specs in src/**/*.spec.ts
pnpm --filter @ardoise/backend test:cov | test:e2e:cov   same with coverage (frontend: test:cov)
pnpm --filter @ardoise/backend test:e2e   HTTP e2e in test/, needs Docker (testcontainers)
pnpm --filter @ardoise/frontend test      Angular unit tests (vitest)
pnpm --filter @ardoise/frontend backdrops regenerate backdrop images (commit the output)
pnpm --filter @ardoise/e2e test:e2e       Playwright scenarios: real backend, testcontainers Postgres, virtual passkeys
pnpm --filter @ardoise/e2e screenshots    every screen/state, light+dark (needs pnpm dev:front; ALL_SIZES=1 for 360/375)
pnpm --filter @ardoise/backend db:generate | db:migrate | db:seed
pnpm --filter @ardoise/backend db:fresh   drop the Postgres volume, migrate, seed (dev data from scratch)
```

vitest builds with SWC and eslint is not type-aware, so green tests and lint say nothing about types. Run `typecheck` before calling work done. `noUncheckedIndexedAccess` is on: prefer `Map.get`, `.find` or destructuring over `arr[i]!`.

Never name a root script `ci`; `pnpm ci` is a pnpm builtin.

## Backend architecture

Each context (`payment`, `member`, `invite-link`, ...) has `domain/`, `application/`, `infrastructure/`:

- `domain/`: entities, repository interfaces with their DI tokens (`PAYMENT_REPOSITORY`), pure functions. No Nest or Drizzle imports.
- `application/`: one `*.use-case.ts` per operation, a thin conductor: load, call domain rules, return.
- `infrastructure/`: controller, Nest module, `*-repository.drizzle.ts`, mapper.

Rules:

- Use the unit of work (`uow.run(repos => ...)`) only for atomic multi-write operations. Pass its transaction-scoped repos as parameters, never inject them. Read-only use cases inject repository tokens directly.
- Extract a domain service only for a real invariant or a second caller.
- Domain errors map to HTTP in `src/shared/http/*-exception.filter.ts`. Request bodies are validated with `ZodValidationPipe` against `@ardoise/shared` contracts.
- Schema lives in `src/shared/database/schema.ts`. Change it, then `db:generate`. Never hand-edit generated migrations.
- ESLint layering rules (`no-restricted-paths`, `no-cycle`) currently match nothing. Lint will not catch a layering violation.

## Domain invariants

Full model in `docs/domain.md`. The ones code must never break:

- Money is integer cents. No floats.
- Shares of a payment always sum to `fullAmount`. Rounding is in `libs/shared/src/split/apportion.ts`.
- `User.role` is the app admin. `Member.isModerator` is the group role. Keep them separate.
- A settlement overlays balances and never mutates payments.

## UI

Read `docs/design.md` before building any screen. In feature templates (`src/app/**` outside `shared/ui` and `shared/variants`):

- Assemble helm components (`libs/ui`) and app building blocks (`src/app/shared/ui`). A new building block goes in `shared/ui` and is called out in the PR.
- Tailwind for layout and spacing only. Theme color classes are fine; Tailwind's default palette does not exist.
- No type-scale, font-weight, tracking or leading classes: use the text directives (`appTitle`, `appBody`, `appMeta`, `appError`, `appEyebrow`, `appFigure`).
- No arbitrary values, no component `.css`, no inline styles.

## Testing

Strategy and coverage are in `docs/testing.md`. Breadth goes in the fast layers; Playwright stays thin. Coverage is not a target: a test earns its place only by catching a bug no other layer catches.

- Pure rules (backend domain, frontend formatting) are pure functions with unit specs covering their edge cases.
- Backend coverage goes into e2e specs in `test/`, with a real Postgres from testcontainers and supertest. Helpers are in `test/helpers/` (`setupTestApp` with provider overrides, `fakePasskeyVerifier`, `seed*` functions). Authorization is tested by the refusal and by checking nothing changed.
- Frontend specs sit next to their component and cover what Playwright reaches badly: loading, errors, empty states, optimistic rollback, validation. Overlap with a scenario is fine; the same detail asserted in both is not. A page spec may fake a store that has its own spec.
- Playwright scenarios in `apps/e2e/e2e/` are named as use cases and run against the real backend, a throwaway Postgres and a Chrome virtual authenticator. One per use case for the main path, plus failures that cross layers; the text a user reads is asserted there. A slice adds about two to five.
- Assert through roles and text, never CSS classes. Only `shared/ui` building blocks may assert the classes they promise.

## Workflow

1. **Slices are whole features** (backend, frontend, tests), listed in `docs/roadmap.md`.
2. **Spec first**: screens, states, flows, edge cases, tap count of the main action, in `docs/superpowers/specs/`. The owner approves before building.
3. **UX forks**: build both behind the dev-only A/B toggle; the owner picks; delete the loser before merge and log the pick in `docs/design.md`.
4. **Build without stopping**: plan in `docs/superpowers/plans/`, then code and commits. Interrupt only for an unclear domain rule or a convention that would need breaking.
5. **PR**: `pnpm verify` green, screenshots of every screen and state in light and dark (393×852, plus 360/375 where they differ), forks side by side.

Branch off `main` for any change. CI (`.github/workflows/ci.yml`) runs the same steps as `pnpm verify`.

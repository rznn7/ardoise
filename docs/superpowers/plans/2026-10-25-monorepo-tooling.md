# Monorepo Tooling Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pnpm workspace cheaper to work in: no build step before lint/typecheck/test, one version of every shared dev tool, one prettier/tsconfig baseline, and a predictable set of scripts that CI calls directly.

**Architecture:** Tools that can read TypeScript (tsc, Angular's esbuild, vitest, typed ESLint) read `libs/shared/src` through a tsconfig `paths` entry or a vitest alias. Only the backend's emitted build and its Node runtime keep using `libs/shared/dist`. Each package keeps its own scripts, all using the same names. The root `package.json` only coordinates them through `pnpm -r` / `--filter`.

**Tech Stack:** pnpm 11 workspaces + catalog, TypeScript 5.9, Angular 21 (`@angular/build:unit-test`), NestJS 11 + nest CLI (tsc), vitest 4, ESLint flat config, Prettier 3, GitHub Actions.

**Spec:** No separate spec doc. The source is the review in the conversation that produced this plan, items #1–#4. Item #5 (`pnpm deploy` for Docker) is out of scope until a backend Dockerfile exists.

## Global Constraints

- Commit messages: a single line, no body, no trailers (user CLAUDE.md).
- No comments in config or code (user CLAUDE.md).
- Work on a feature branch, not `main`.
- Catalog entries use exact versions, like the existing ones (`zod: 4.4.3`).
- Don't disable an ESLint rule to make lint pass. Fix the code, or stop and ask.
- `tsc --noEmit` is the required typecheck. vitest and eslint do not typecheck.

## Decisions (why the plan looks like this)

- **`paths`/alias, not a custom `exports` condition.** Angular's esbuild and vite each configure resolve conditions differently. A `paths` entry is the mechanism the frontend already uses (spartan helm libs), and the backend vitest configs already alias `src`.
- **The backend build keeps using `dist`.** If `nest build` compiled shared's source, it would emit files outside `outDir`. Node can't run shared's TS at runtime either. So `tsconfig.build.json` clears `paths`. `pnpm dev` keeps the shared `tsc --watch` so the running backend still picks up contract changes.
- **Scripts stay per-package and are not moved to the root.** `nest`, `ng`, `drizzle-kit` and `vitest` resolve their config from the package directory. Moving the scripts to the root would mean prefixing every one with `--dir`/`cd`, and `pnpm --filter X <script>` would stop working. The root only coordinates.
- **`test` runs once everywhere and `test:watch` is the interactive one.** This is a different shape from the suggested `test:ci`. The default command is safe in CI and from `pnpm -r`, and watch mode is something you ask for by name.
- **Prettier: one root config with a frontend override (`printWidth: 100`).** This keeps today's formatting byte-identical. Choosing one width for the whole repo is a later, separate reformat commit.

## Review Focus

1. Fresh clone with no `libs/shared/dist`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` and `ng build` must all pass. Covered by Task 1 Step 6 and Task 4 Step 6.
2. Production backend still resolves shared from `dist`: after `pnpm build:back`, `node -e "require('@ardoise/shared')"` from `apps/backend` must work. Covered by Task 1 Step 7.
3. Root `pnpm test` in a real terminal must exit and never enter watch mode. Covered by Task 4 Step 5.
4. The prettier move must not reformat anything: `prettier --check` must be clean in all three packages. Covered by Task 3 Step 4.
5. ESLint 10 on the backend/shared may enable new recommended rules. `pnpm lint` must stay green with real fixes, not disabled rules. Covered by Task 2 Step 4.

---

### Task 1: Consume `@ardoise/shared` from source everywhere except the backend build

**Files:**
- Modify: `apps/frontend/tsconfig.json` (`compilerOptions.paths`)
- Modify: `apps/backend/tsconfig.json` (`compilerOptions.paths`)
- Modify: `apps/backend/tsconfig.build.json` (`compilerOptions.paths: {}`)
- Modify: `apps/backend/vitest.config.ts`, `apps/backend/vitest.config.e2e.ts` (`resolve.alias`)

**Interfaces:**
- Produces: `@ardoise/shared` resolves to `libs/shared/src/index.ts` for tsc (`tsconfig.json`), Angular build/test, vitest and typed ESLint. It resolves to `libs/shared/dist` only for `nest build`/`nest start` and Node.

- [ ] **Step 1: Branch.** `git switch -c chore/monorepo-tooling`

- [ ] **Step 2: Reproduce the failure.** Run `rm -rf libs/shared/dist && pnpm --filter @ardoise/backend exec tsc --noEmit`. Expected: FAIL with `Cannot find module '@ardoise/shared'`.

- [ ] **Step 3: Frontend.** In `apps/frontend/tsconfig.json`, add `"@ardoise/shared": ["../../libs/shared/src/index.ts"]` to `paths`. `baseUrl` is `.`, so the path is relative to `apps/frontend`.

- [ ] **Step 4: Backend type-level.** In `apps/backend/tsconfig.json`, add `"paths": { "@ardoise/shared": ["../../libs/shared/src/index.ts"] }`. In `apps/backend/tsconfig.build.json`, add `"compilerOptions": { "paths": {} }` so nest's build keeps resolving through `node_modules` to `dist`.

- [ ] **Step 5: Backend vitest.** In both vitest configs, add `'@ardoise/shared': resolve(__dirname, '../../libs/shared/src/index.ts')` next to the existing `src` alias.

- [ ] **Step 6: Verify with dist still deleted** (`ls libs/shared/dist` must fail first):
  - `pnpm --filter @ardoise/backend exec tsc --noEmit`: no output
  - `pnpm --filter @ardoise/backend exec vitest run`: PASS
  - `pnpm --filter @ardoise/backend exec vitest run --config ./vitest.config.e2e.ts`: PASS (needs Docker)
  - `pnpm --filter @ardoise/frontend exec ng test --watch=false`: PASS
  - `pnpm --filter @ardoise/frontend exec ng build`: succeeds
  - `pnpm lint`: PASS

- [ ] **Step 7: Verify the runtime path.** Run `pnpm --filter @ardoise/backend... build`, then `cd apps/backend && node -e "console.log(Object.keys(require('@ardoise/shared')).length)"`. Expected: a positive number. Also check that `grep -r "libs/shared/src" apps/backend/dist` prints nothing.

- [ ] **Step 8: Commit.** `git commit -am "chore: resolve @ardoise/shared from source outside backend build"`

---

### Task 2: Catalog the shared dev tooling and align ESLint on v10

**Files:**
- Modify: `pnpm-workspace.yaml` (`catalog`)
- Modify: `apps/backend/package.json`, `apps/frontend/package.json`, `libs/shared/package.json` (devDependencies → `catalog:`)
- Modify: `pnpm-lock.yaml` (via `pnpm install`)

**Interfaces:**
- Produces: catalog keys `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-plugin-prettier`, `eslint-plugin-import`, `eslint-plugin-simple-import-sort`, `eslint-import-resolver-typescript`.

- [ ] **Step 1: Add catalog entries.** Use exact versions taken from `pnpm-lock.yaml`. For `eslint` and `@eslint/js`, take the version the frontend resolves today (v10). For `typescript-eslint`, take the version the backend resolves (the higher one, ^8.61). For the rest, take the version they currently resolve to (they are identical across packages).

- [ ] **Step 2: Switch every package to the catalog.** In every package that lists one of those eight deps, replace the version with `catalog:`. Remove `@eslint/eslintrc` from the backend; nothing imports it. Leave `angular-eslint`, `eslint-config-prettier` and `@types/node` as they are, since each is used by only one package.

- [ ] **Step 3: Install.** Run `pnpm install`. Expected: completes, and the lockfile shows a single `eslint@10.x` and a single `typescript-eslint` version.

- [ ] **Step 4: Verify.** Run `pnpm lint` and expect PASS. If ESLint 10's recommended set reports new errors in backend or shared, fix the code. If a fix isn't obvious, stop and report the rule and file.

- [ ] **Step 5: Commit.** `git commit -am "chore: catalog eslint tooling and align on eslint 10"`

---

### Task 3: Root prettier config and shared tsconfig base

**Files:**
- Create: `.prettierrc`
- Delete: `apps/backend/.prettierrc`, `apps/frontend/.prettierrc`, `libs/shared/.prettierrc`
- Create: `tsconfig.base.json`
- Modify: `apps/backend/tsconfig.json`, `apps/frontend/tsconfig.json`, `libs/shared/tsconfig.json` (`extends`, drop duplicated flags)

**Interfaces:**
- Produces: `tsconfig.base.json` holding `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `isolatedModules`.

- [ ] **Step 1: Root `.prettierrc`.** Use `singleQuote: true` and `trailingComma: "all"`, plus overrides:
  - `files: "apps/frontend/**"` → `printWidth: 100`
  - `files: "*.html"` → `parser: "angular"`

  Then delete the three package `.prettierrc` files.

- [ ] **Step 2: `tsconfig.base.json`** with the flags listed under Interfaces.

- [ ] **Step 3: Extend it.**
  - Each package tsconfig gets `"extends": "../../tsconfig.base.json"`, and every flag the base now provides is removed from it.
  - The backend also drops `strictNullChecks`, `noImplicitAny`, `strictBindCallApply`, `strictFunctionTypes`, `noImplicitThis`, `alwaysStrict` and `useUnknownInCatchVariables`, because `strict` covers them all. Running `tsc --strict` on the backend was already confirmed clean.
  - Everything module- or target-specific stays in the package: `module`, `moduleResolution`, `target`, decorators, `outDir`, `baseUrl`, `paths`, `angularCompilerOptions`.

- [ ] **Step 4: Verify.**
  - Run `pnpm -r exec prettier --check src` and `pnpm --filter @ardoise/backend exec prettier --check test`. Expected: "All matched files use Prettier code style!"
  - `tsc --noEmit` in backend (`-p tsconfig.json`), frontend (`-p tsconfig.app.json` and `-p tsconfig.spec.json`) and shared: all clean.
  - `pnpm --filter @ardoise/frontend exec ng build`: succeeds.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "chore: share prettier and tsconfig base at workspace root"`

---

### Task 4: Uniform scripts, root orchestration, CI uses the scripts

**Files:**
- Modify: `apps/backend/package.json`, `apps/frontend/package.json`, `libs/shared/package.json` (`scripts`)
- Modify: `package.json` (root `scripts`)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: per-package script names `dev`, `build`, `typecheck`, `lint`, `format`, `test`, `test:watch`, `test:cov`, `test:e2e`, plus the backend-only `test:debug` and `db:*`. Root script names are listed in Step 3.

- [ ] **Step 1: Per-package scripts.** Every script that runs once must also exit when started from a terminal.

  | script | backend | frontend | shared |
  |---|---|---|---|
  | `typecheck` | `tsc --noEmit` | `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.spec.json` | `tsc --noEmit` |
  | `test` | `vitest run` | `ng test --watch=false` | — |
  | `test:watch` | `vitest watch` | `ng test --watch` | — |
  | `test:cov` | `vitest run --coverage` | `ng test --watch=false --coverage` (fixes the invalid `--code-coverage`) | — |
  | `test:e2e` | `vitest run --config ./vitest.config.e2e.ts` | — | — |

  Leave all other existing scripts unchanged.

- [ ] **Step 2: Remove `dev:shared` and `build:shared` from the root.** The root `dev` calls `pnpm --filter @ardoise/shared build` and `pnpm --filter @ardoise/shared dev` directly. Nothing else needs them now.

- [ ] **Step 3: Root scripts.** Use exactly this set:
  - `dev`: as today, minus the removed aliases
  - `dev:front`, `dev:back`
  - `build`: `pnpm -r build`
  - `build:front`: `pnpm --filter @ardoise/frontend... build`
  - `build:back`: `pnpm --filter @ardoise/backend... build` (the `...` builds shared first)
  - `typecheck`: `pnpm -r --parallel --if-present typecheck`
  - `lint`: `pnpm -r --parallel --if-present lint`
  - `format`: `pnpm -r --if-present format`
  - `test`: `pnpm -r --if-present test`
  - `test:cov`: `pnpm -r --if-present test:cov`
  - `test:e2e`: `pnpm -r --if-present test:e2e`
  - `test:watch:front`: `pnpm --filter @ardoise/frontend test:watch`
  - `test:watch:back`: `pnpm --filter @ardoise/backend test:watch`
  - `ci`: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`

- [ ] **Step 4: CI.** In `.github/workflows/ci.yml`:
  - Remove every `pnpm build:shared` step and both comments.
  - Job `lint` runs `pnpm lint`.
  - New job `typecheck` runs `pnpm typecheck`.
  - `backend-unit` runs `pnpm --filter @ardoise/backend test`.
  - `frontend-unit` runs `pnpm --filter @ardoise/frontend test`.
  - `backend-e2e` runs `pnpm test:e2e`.
  - New job `build` runs `pnpm build`.

  Keep the existing checkout/pnpm/node setup steps in each job.

- [ ] **Step 5: Verify in a real terminal.** Run `pnpm test` from the repo root in an interactive shell. Expected: both packages run once and the process exits 0. Then run `pnpm typecheck` and `pnpm test:cov`; both exit 0, and frontend coverage output appears.

- [ ] **Step 6: Verify the whole pipeline from a clean state.** Run `rm -rf libs/shared/dist apps/*/dist && pnpm ci`. Expected: exit 0.

- [ ] **Step 7: Commit.** `git commit -am "chore: uniform package scripts and drive ci through them"`

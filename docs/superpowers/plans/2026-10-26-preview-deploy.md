# Preview Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push to `main` that passes CI publishes images that the owner deploys with one command to `https://ardoise.rznn.dev` on the homelab, with fresh demo data built around the owner's kept account.

**Architecture:** CI publishes two images to GHCR: `ardoise-backend` (API plus migrate and seed tooling) and `ardoise-web` (Caddy serving the Angular build and proxying `/api`). The owner pulls `:main` on the homelab by hand over SSH. The backend container migrates, re-seeds and starts. The seed keeps every user with a passkey and rebuilds the scenario around the oldest one.

**Tech Stack:** Docker, Caddy 2, GitHub Actions + GHCR, NestJS, Drizzle (`drizzle-kit migrate`), `pg`, vitest + testcontainers.

**Spec:** `docs/superpowers/specs/2026-10-26-preview-deploy-design.md`

## Prerequisite

`feat/payments` is merged into `main`. Then `git rebase main` on `feat/deploy`. Task 1 builds on that branch's `apps/backend/scripts/seed-dev.ts` (the Lisbon / Flatshare / Ski 2027 scenario). Do not start Task 1 before this.

## Global Constraints

- Preview values: `RP_ID=ardoise.rznn.dev`, `EXPECTED_ORIGIN=https://ardoise.rznn.dev`, `COOKIE_SECURE=true`.
- Images: `ghcr.io/rznn7/ardoise-backend` and `ghcr.io/rznn7/ardoise-web`, tagged `:main` and `:<git sha>`. Base images pinned to an exact version, never `:latest`.
- The backend has no global prefix. `/api` is stripped by the proxy, as in `apps/frontend/proxy.conf.json`.
- Registration stays invite-only. No open sign-up, no deterministic invite tokens in the seed.
- The seed never creates passkeys. It never prints a session token unless `EXPECTED_ORIGIN` is `http://localhost[:port]`.
- Only `web` joins the homelab's `homelab` network. `db` and `backend` are on `ardoise` alone, which is `internal: true`.
- The builder does not touch the homelab host. Homelab changes ship as a PR on `rznn7/homelab`.
- Commit messages: one line, conventional prefix, no body.

## Review Focus

1. **Running the deploy command with no new image must not reset data.** `docker compose up -d` only recreates changed containers. Verified in Task 5: two runs in a row, same backend `StartedAt`.
2. **A deep link refreshed in the browser** (`/groups/3`) serves `index.html`, while an unknown `/api/...` path returns Nest's JSON 404 rather than `index.html`. Smoke-checked in Task 3.
3. **A seed run on a database where the owner created their own groups from the phone** wipes those groups but keeps the account and its session. Test in Task 1.
4. **Running the seed twice** gives the same counts, with no duplicated fictional users. Test in Task 1.
5. **The session cookie behind Cloudflare** carries `Secure` when `COOKIE_SECURE=true`, and not otherwise, so local HTTP dev keeps working. Test in Task 2.

---

### Task 1: Seed keeps real accounts

Why this lives in `scripts/`: the seed is tooling that writes tables directly, outside the hexagonal layers. It has no use case or port because no application code calls it. It still goes through `computePaymentShares` so shares sum to `fullAmount`.

**Files:**
- Create: `apps/backend/scripts/seed/demo-scenario.ts` (the scenario, exported, no side effects on import)
- Modify: `apps/backend/scripts/seed-dev.ts` (thin CLI: connect, call, print)
- Modify: `apps/backend/tsconfig.json` (add `"scripts/**/*"` to `include`, so `typecheck` covers the seed)
- Test: `apps/backend/test/seed-dev.e2e-spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DemoSeedReport = {
    primaryUserId: number;
    realAccountCount: number;
    inviteUrl: string;
    sessionToken: string | null;
  };
  export async function seedDemo(client: Client, opts: { origin: string }): Promise<DemoSeedReport>;
  ```
  The CLI calls `seedDemo(client, { origin: process.env['EXPECTED_ORIGIN'] ?? 'http://localhost:4200' })`.

Algorithm for `seedDemo`, in order:
1. `TRUNCATE payment_share, payment, member, invite_link, login_state, registration_state, expense_group RESTART IDENTITY CASCADE`.
2. `DELETE FROM users u WHERE NOT EXISTS (SELECT 1 FROM passkey p WHERE p.user_id = u.id)`. Sessions of deleted users go with them through the cascade.
3. Real accounts: `SELECT id FROM users ORDER BY id`. The first one is the primary user. If there is none, create `Alice` with no passkey.
4. Create Bob, Carol, David and the three groups exactly as today, with the primary user in Alice's place everywhere (memberships, moderator flags, payers, participants).
5. Every other real account joins Trip to Lisbon, Flatshare and Ski 2027 as a plain member, outside every payment.
6. Create the Lisbon invite link as today (`singleUse: false`). `inviteUrl = new URL('/join?token=' + token, origin).href`.
7. `sessionToken`: only if no real account existed and `origin` has protocol `http:` and hostname `localhost`, `seedSession` for Alice. Otherwise `null`.

- [ ] **Step 1: Write the failing tests** in `test/seed-dev.e2e-spec.ts`, with `setupTestApp()` for the Postgres container and `TRUNCATE ... users, passkey, session ... CASCADE` in `afterEach`, like `authentication.e2e-spec.ts`:
  - `builds the scenario around a fictional Alice when there is no real account`: `seedDemo(pgClient, { origin: 'http://localhost:4200' })`. Expect a user named `Alice`, `report.primaryUserId` equal to her id, `report.sessionToken` not null, `SELECT count(*) FROM passkey` = 0, 3 groups, 7 payments, Alice moderator of Trip to Lisbon and Ski 2027 and plain member of Flatshare.
  - `never prints a session token off localhost`: origin `https://ardoise.rznn.dev`, no real account. Expect `sessionToken` null, `SELECT count(*) FROM session` = 0, `inviteUrl` starts with `https://ardoise.rznn.dev/join?token=`.
  - `keeps a real account and puts it in Alice's place`: `seedUser` named `Owner` + `seedPasskey` + `seedSession` with token `kept-token`. Seed with the https origin. Expect the owner, their passkey and the `kept-token` session still there, no user named `Alice`, `primaryUserId` = owner id, owner moderator of Trip to Lisbon, the `Pizza` payment paid by the owner's member, `sessionToken` null.
  - `wipes groups a real account created itself`: owner as above, plus `seedGroup` `Phone group` with the owner as moderator. After the seed, no `Phone group`, owner session kept.
  - `makes the oldest real account primary and the others plain members`: two users with passkeys, A created before B. Expect A moderator of Trip to Lisbon, B member of all three groups with `is_moderator = false`, B in no `payment_share`.
  - `is idempotent`: seed twice with one real account. Users count, groups (3), payments (7), shares count identical between runs, and the user names `Bob`, `Carol`, `David` appear once each.

- [ ] **Step 2: Run them to see them fail**
  Run: `pnpm --filter @ardoise/backend test:e2e -- seed-dev`
  Expected: FAIL, `seedDemo` cannot be imported.

- [ ] **Step 3: Implement `seedDemo` in `scripts/seed/demo-scenario.ts`** following the algorithm above. Move the existing scenario out of `seed-dev.ts`. Drop the `seedPasskey` line. `seed-dev.ts` keeps `dotenv/config`, opens the client, calls `seedDemo`, prints the scenario summary, `inviteUrl`, and the cookie instructions only when `sessionToken` is not null, then a line saying how many real accounts were kept.

- [ ] **Step 4: Run tests, typecheck, lint**
  Run: `pnpm --filter @ardoise/backend test:e2e -- seed-dev && pnpm typecheck && pnpm lint`
  Expected: all green.

- [ ] **Step 5: Check by hand on the dev database**
  Run: `pnpm --filter @ardoise/backend db:fresh` and read the output.
  Expected: Alice summary, a localhost invite URL, the session cookie instructions, `0 real accounts kept`.

- [ ] **Step 6: Commit**
  `git commit -m "feat(backend): dev seed keeps real accounts and rebuilds the scenario around them"`

---

### Task 2: Secure session cookie from config

Why in `shared/http`: the cookie is an HTTP delivery detail of the infrastructure layer. The domain only knows the token and its TTL.

**Files:**
- Modify: `apps/backend/src/shared/http/session-cookie.ts`
- Modify: `apps/backend/.env.example` (add `COOKIE_SECURE=false`)
- Test: `apps/backend/test/authentication.e2e-spec.ts`

**Interfaces:**
- Produces: env var `COOKIE_SECURE`. The string `'true'` gives `secure: true`, anything else gives `false`. Read when the cookie is set (`process.env`, same style as `PORT` in `main.ts`), so a test can flip it.

- [ ] **Step 1: Write the failing tests** in the `register` describe:
  - `sets a Secure session cookie when COOKIE_SECURE is true`: set `process.env['COOKIE_SECURE'] = 'true'`, run the existing begin and complete registration flow, expect the `set-cookie` header to contain `Secure`. Delete the variable in a `finally`.
  - `sets a non-Secure session cookie by default`: same flow without the variable, expect `set-cookie` not to contain `Secure`.

- [ ] **Step 2: Run them to see the first fail**
  Run: `pnpm --filter @ardoise/backend test:e2e -- authentication`
  Expected: the Secure test FAILS.

- [ ] **Step 3: Replace `secure: false, //TODO…`** with the `COOKIE_SECURE` check.

- [ ] **Step 4: Run tests and typecheck**
  Run: `pnpm --filter @ardoise/backend test:e2e -- authentication && pnpm typecheck`
  Expected: green.

- [ ] **Step 5: Commit**
  `git commit -m "feat(backend): session cookie is Secure when COOKIE_SECURE is true"`

---

### Task 3: Docker images

**Files:**
- Create: `.dockerignore` (`**/node_modules`, `**/dist`, `**/coverage`, `.git`, `**/.env`, `apps/e2e/test-results`, `apps/e2e/playwright-report`)
- Create: `apps/backend/Dockerfile`
- Create: `apps/frontend/Dockerfile`
- Create: `apps/frontend/Caddyfile`

**Interfaces:**
- Produces, for Task 5:
  - backend image: listens on `3000`, reads `DATABASE_URL`, `RP_ID`, `RP_NAME`, `EXPECTED_ORIGIN`, `COOKIE_SECURE`. On start: `pnpm db:migrate && pnpm db:seed && pnpm start`, run from `apps/backend`.
  - web image: listens on `80`, proxies `/api/*` to `http://backend:3000` (compose service name `backend`).

Decisions:
- Build context is the repo root for both: `docker build -f apps/backend/Dockerfile .`
- Base `node:24-bookworm-slim` pinned to its current exact `24.x` tag. pnpm from `corepack enable` (the root's `packageManager` field pins it).
- Backend: one stage is fine (fat image by design). `pnpm install --frozen-lockfile`, then `pnpm --filter @ardoise/backend... build` (builds `@ardoise/shared` first). Keep dev dependencies: `drizzle-kit` and `tsx` run at start.
- Web: build stage as above with `pnpm --filter @ardoise/frontend... build`, final stage `caddy:2.x-alpine` pinned, copying the Angular `browser` output (`apps/frontend/dist/frontend/browser`, check the actual path after a build) to `/srv`.
- Caddyfile: `:80`. `handle_path /api/*` → `reverse_proxy backend:3000`. `handle /version.json`: `header Cache-Control no-store`, `root * /srv`, `file_server`. Default `handle`: `root * /srv`, `try_files {path} /index.html`, `file_server`.
- Version: the web Dockerfile takes `ARG GIT_SHA=dev` and `ARG GIT_DATE=` and writes `/srv/version.json` as `{"sha":"$GIT_SHA","date":"$GIT_DATE"}` in the final stage.

- [ ] **Step 1: Write the four files.**

- [ ] **Step 2: Build both images**
  Run: `docker build -f apps/backend/Dockerfile -t ghcr.io/rznn7/ardoise-backend:main . && docker build -f apps/frontend/Dockerfile -t ghcr.io/rznn7/ardoise-web:main .`
  Expected: both succeed.

- [ ] **Step 3: Smoke-run them together** in a throwaway network (`docker network create ardoise-smoke`), with `postgres:16` as `db`, the backend as `backend` (`DATABASE_URL=postgres://ardoise:smoke@db:5432/ardoise`, `EXPECTED_ORIGIN=http://localhost:8080`, `RP_ID=localhost`, `RP_NAME=Ardoise`) and the web image as `web` with `-p 8080:80`. Then:
  - `docker logs backend` shows the migrations applied and the seed summary with a `http://localhost:8080/join?token=` link,
  - `curl -s -o /dev/null -w '%{http_code}' localhost:8080/` → `200`,
  - `curl -s localhost:8080/groups/3 | grep -c '<app-root'` → `1` (SPA fallback),
  - `curl -s -o /dev/null -w '%{http_code}' localhost:8080/api/auth/me` → `401`,
  - `curl -si localhost:8080/version.json` → `{"sha":"smoke",...}` and a `Cache-Control: no-store` header (build the web image with `--build-arg GIT_SHA=smoke --build-arg GIT_DATE=2026-10-26T00:00:00Z`),
  - `curl -s localhost:8080/api/does-not-exist` → Nest's JSON `{"message":"Cannot GET /does-not-exist",...}`, not HTML,
  - opening the printed invite link in Chrome on `http://localhost:8080` and registering with a passkey works.
  Clean up the containers and the network.

- [ ] **Step 4: Commit**
  `git commit -m "build: backend and web Docker images for the preview deploy"`

---

### Task 4: Publish images from CI on main

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Add a `publish` job**: `needs: [lint, typecheck, backend-unit, frontend-unit, e2e, build]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `permissions: { contents: read, packages: write }`. Steps: checkout, `docker/setup-buildx-action`, `docker/login-action` to `ghcr.io` with `GITHUB_TOKEN`, then `docker/build-push-action` twice (backend, web) with `context: .`, the matching `file:`, `push: true`, tags `ghcr.io/rznn7/ardoise-<name>:main` and `:${{ github.sha }}`, `build-args` `GIT_SHA=${{ github.sha }}` and `GIT_DATE=<commit date>` on the web image, the date from a prior step `git log -1 --format=%cI` written to `$GITHUB_OUTPUT`, and GHA cache (`cache-from: type=gha,scope=<name>`, `cache-to: type=gha,mode=max,scope=<name>`). Pin each action to its current major.

- [ ] **Step 2: Lint the workflow**
  Run: `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:<current version>`
  Expected: no output.

- [ ] **Step 3: Update `docs/roadmap.md`**: add a checked-off-on-merge item `**preview deploy**: every main push live on ardoise.rznn.dev (homelab), demo data reset, accounts kept.` above `deploy`. Reword `deploy` to `production deploy (Docker compose + Hetzner).`

- [ ] **Step 4: Commit**
  `git commit -m "ci: publish backend and web images to GHCR on main"`

---

### Task 5: Homelab service (PR on `rznn7/homelab`)

Work in a clone in the scratchpad, on a branch `ardoise-preview`. Follow the conventions in its README ("Adding a service").

**Files (homelab repo):**
- Create: `ardoise/docker-compose.yml`
- Create: `ardoise/.env.example`
- Modify: `automation/update-apply.sh` (`EXCLUDE=("nextcloud" "ardoise")`)
- Modify: `renovate.json` (a rule disabling `ardoise/**`, same shape as the Nextcloud one)
- Modify: `README.md` (directory table, access table `ardoise.rznn.dev` / anywhere, and an "Ardoise preview" section with the deploy, `docker compose images`, reset, full wipe and psql commands from the spec's Operations section)

**Interfaces:**
- Consumes: Task 3 images and env vars.

Decisions:
- `docker-compose.yml`: services `db` (`postgres:16.x` pinned, `POSTGRES_USER=ardoise`, `POSTGRES_DB=ardoise`, password from `.env`, named volume `ardoise_pgdata`, healthcheck `pg_isready`), `backend` (`ghcr.io/rznn7/ardoise-backend:main`, `env_file: .env`, `depends_on: db: condition: service_healthy`), `web` (`ghcr.io/rznn7/ardoise-web:main`, `depends_on: backend`). `container_name: ardoise-db|ardoise-backend|ardoise-web`, `restart: unless-stopped`, no `ports:` anywhere. Networks: `ardoise` (`internal: true`) for all three, `homelab` (`external: true`) for `web` only.
- `.env.example`: `POSTGRES_PASSWORD=`, `DATABASE_URL=postgres://ardoise:<POSTGRES_PASSWORD>@db:5432/ardoise`, `RP_ID=ardoise.rznn.dev`, `RP_NAME=Ardoise`, `EXPECTED_ORIGIN=https://ardoise.rznn.dev`, `COOKIE_SECURE=true`.

- [ ] **Step 1: Write the files.**

- [ ] **Step 2: Validate the compose file**
  Run (in the clone): `cp ardoise/.env.example ardoise/.env && docker compose -f ardoise/docker-compose.yml config -q && rm ardoise/.env`
  Expected: no output.

- [ ] **Step 3: Check that an unchanged image does not restart the backend.** Locally, with Task 3's images tagged `:main`, a dummy `.env`, and `docker network create homelab` if missing: `docker compose up -d`, note `docker inspect -f '{{.State.StartedAt}}' ardoise-backend`, run `docker compose up -d` again, compare. Expected: same `StartedAt`. `docker compose down -v` afterwards. (`pull` is skipped here because the images are local only.)

- [ ] **Step 4: Commit and open the PR.** One-line commit `feat: ardoise preview from GHCR, deployed by hand`. Push the branch and open a PR whose body is the owner's checklist, from the spec:
  1. Merge, then `git pull` on the host.
  2. `cp ardoise/.env.example ardoise/.env` and fill in `POSTGRES_PASSWORD` and `DATABASE_URL`.
  3. After the first `publish` run on `rznn7/ardoise`, make both GHCR packages public (package settings → Change visibility).
  4. Cloudflare Zero Trust → Networks → Tunnels → Public Hostnames: `ardoise.rznn.dev` → `http://ardoise-web:80`.
  5. In `~/homelab/ardoise`: `docker compose up -d`, then `docker compose logs backend`, open the printed invite link on the phone, register, then `docker compose restart backend`.
  End the body with the attribution line.

---

## After all tasks

- `pnpm verify` green on `feat/deploy`. Push and open the Ardoise PR, linking the homelab PR. No screenshots: this slice has no screen.
- The end-to-end check, a push to `main` then the deploy command, is done by the owner after the homelab checklist.

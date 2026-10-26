# Preview deploy on the homelab

## Why

The owner wants to try Ardoise on a real phone without running anything by hand. Today that means `pnpm dev` on a laptop and a desktop browser's mobile view, which hides everything a phone does differently: real passkeys, the on-screen keyboard, touch, the installed-app feel later on.

The goal is an instance that is always up to date: every update of `main` gives a fresh instance at `https://ardoise.rznn.dev`, with demo data reset, and the owner still logged in on their phone.

It is not production, and won't be for a while. Nothing on it is worth keeping except the owner's account.

## Goals

- A push to `main` that passes CI publishes images. The owner brings the preview up to date with one command over SSH, when it suits them: an automatic deploy would wipe the demo data in the middle of a test on the phone.
- Each deploy resets the demo data to the seed scenario.
- Real accounts (users with a passkey) survive the reset, so the owner registers once per environment and stays logged in.
- The same seed behaviour works in local dev: register once on `localhost` with a real passkey and stop pasting session cookies.
- A manual reset is one command over SSH.

## Non-goals

- Production concerns: backups, hardening containers (`read_only`, `cap_drop`, non-root), zero-downtime deploys, monitoring.
- A separate staging environment. When friends start using it for real, this design is revisited: a `fresh` on every deploy would wipe their data.
- Session renewal. Sessions last a fixed 7 days (`SESSION_TTL_MS`), so "stays logged in" means signing in again with the passkey once a week. Accepted for a preview.
- Postgres access from the owner's workstation. `ssh -L` is enough when it comes up.
- Hetzner. The roadmap's `deploy` item stays for the eventual production deploy. This slice is the preview only.
- SSE. Not built yet. When it is, it needs a heartbeat under ~100 s because Cloudflare cuts idle connections.

## Anti-goals (failure even if it technically works)

- A compromise of Ardoise reaches the rest of the homelab. The homelab's isolation rests on which interface each port is published on, but every container shares the `homelab` Docker network, where those bindings don't apply: from there, `portainer:9000` (which mounts the Docker socket) is one request away. Ardoise is new code with hand-written auth on a public domain, so it must not sit on that network.
- Any login shortcut on the public domain (dev login route, seeded session printed into logs and reused). Auth on `ardoise.rznn.dev` is passkeys only.
- A deploy credential stored in GitHub that opens a path into the house. Deploys are pulled by the homelab, never pushed into it.

## Constraints

- **Passkeys are bound to the domain.** `RP_ID=ardoise.rznn.dev`, `EXPECTED_ORIGIN=https://ardoise.rznn.dev`. Both are already read from config (`passkey-verifier.simplewebauthn.ts`). Passkeys on `localhost` and on `ardoise.rznn.dev` are separate accounts, which is expected.
- **One origin.** The frontend and the API are served from `ardoise.rznn.dev`, the API under `/api` with the prefix stripped, as `proxy.conf.json` does in dev. The backend has no global prefix and keeps none.
- **Secure cookie.** `session-cookie.ts` has `secure: false` with a TODO. The preview needs `secure: true`, driven by config so local dev over plain HTTP keeps working.
- **The homelab's conventions** (repo `rznn7/homelab`, README "Adding a service"): one directory per service with a `docker-compose.yml`, container names unique across the host, public services have no host port and are reached by `cloudflared` by container name, the tunnel's routing lives in the Cloudflare dashboard, secrets in an ignored `.env` with a `.env.example`.
- **The homelab's nightly updater and Renovate expect pinned semver tags.** Ardoise runs on a floating `:main` tag, so it is excluded from both.
- **The repo is public**, so GHCR images can be public too and the homelab pulls them without a token.

## Decisions

### Images

Two images, built from the monorepo root as the build context, published to `ghcr.io/rznn7/ardoise-backend` and `ghcr.io/rznn7/ardoise-web`:

- **backend**: one image that runs the API and also carries what migrating and seeding need (`drizzle-kit`, `tsx`, `scripts/`, `test/helpers/seed.ts`). Heavier than a production image would be, which is fine for a preview. Its entrypoint: migrate, seed with accounts kept, start.
- **web**: Caddy serving the Angular build, with SPA fallback to `index.html`, and proxying `/api/*` to `backend` with the prefix stripped. Caddy listens on plain HTTP: Cloudflare terminates TLS.

**Which version is running.** The web image serves `/version.json`, `{"sha": "<full git sha>", "date": "<commit date, ISO 8601>"}`, written at image build time from build args the CI passes. Caddy serves it with `Cache-Control: no-store`. The owner opens `https://ardoise.rznn.dev/version.json` on the phone or the PC when in doubt. No application code and no screen: the owner chose this over a visible version line in the UI. An image built without the args reports `"sha": "dev"`.

Tags: `:main` (what the homelab follows) and `:<git sha>` (to know what is running and roll back by hand).

### CI

A `publish` job in `.github/workflows/ci.yml`, only on `push` to `main`, needing every existing job. It builds and pushes both images. `permissions: packages: write` on that job only.

### Homelab side (repo `rznn7/homelab`)

A new `ardoise/` directory:

- `docker-compose.yml` with three services, container names prefixed `ardoise-`:
  - `ardoise-db`: Postgres 16, named volume, network `ardoise` only.
  - `ardoise-backend`: network `ardoise` only. Env from `.env`.
  - `ardoise-web`: networks `ardoise` and `homelab` (the only one on `homelab`, so `cloudflared` reaches it). No host port.
- `.env.example`: `POSTGRES_PASSWORD`, `DATABASE_URL`, `RP_ID`, `RP_NAME`, `EXPECTED_ORIGIN`, the secure-cookie flag.
- No timer. Updating is manual (see Operations). An automatic pull can be added later as a systemd timer, if wanted.
- `ardoise` added to `EXCLUDE` in `automation/update-apply.sh` and ignored in `renovate.json`.
- README: the service in both tables (`ardoise.rznn.dev`, from anywhere), the deploy and reset commands.

These changes are delivered as a PR on `rznn7/homelab`. The builder does not touch the host. The PR description carries the owner's checklist, run once:

1. Merge the PR, then `git pull` on the host.
2. Fill in `ardoise/.env` from `.env.example`.
3. Make both GHCR packages public in their package settings, after the first `publish` run. Packages pushed from Actions start out private.
4. Add the public hostname `ardoise.rznn.dev → http://ardoise-web:80` in the Cloudflare Zero Trust dashboard.

The end-to-end check, a push to `main` then the deploy command, happens once the checklist is done.

### Seed: keep real accounts

`seed-dev.ts` changes from "truncate everything, create Alice and print her session token" to:

1. Keep every user that has at least one passkey, with their passkeys and sessions. These are the "real accounts".
2. Delete everything else: groups, members, payments, shares, invite links, login and registration states, and users without a passkey (the previous seed's fictional people).
3. Rebuild the scenario. The fictional people (Bob, Carol, ...) are recreated without passkeys. Every real account is added to the scenario's groups. The oldest real account takes the place the primary user has today (moderator, payer of its payments, ...). Others join as plain members.
4. With no real account at all, the fictional primary user (Alice) stands in for the owner. Only when `EXPECTED_ORIGIN` is a plain-HTTP `localhost` origin does the seed also mint a session for her and print the token, so a brand-new local database stays usable before anyone has registered. On the preview it never prints a token.

**Real vs fictional.** A real account is a user with at least one passkey, and the seed never creates passkeys. The `feat/payments` seed gives Alice a fake one (`dev-alice`), which nothing reads: no screen or endpoint lists passkeys, and her seeded session is what logs her in. That line goes. The rule then holds by construction: apart from the seed, the only code that writes a passkey is `CompleteRegistrationUseCase`, after the verifier has checked a real authenticator's attestation. No schema change, no naming convention. A local database seeded by the old version still holds `dev-alice` and needs one `db:fresh`.

**First account on the preview.** Registration is invite-only today: `BeginRegistrationUseCase` refuses without a usable invite token and `CompleteRegistrationUseCase` consumes it. That is what keeps strangers out of `ardoise.rznn.dev`, and nothing in this slice may weaken it (no open sign-up, no deterministic invite tokens in the seed). The seed prints an invite link to the scenario's main group, built on `EXPECTED_ORIGIN`. On the first deploy the owner reads it from `docker compose logs backend`, opens it on the phone and registers. From the next reset on, the owner is the real account the scenario is built around.

The seed is tooling, not application code: it lives in `scripts/` and writes tables directly, outside the hexagonal layers. It must still produce data the domain accepts (shares summing to `fullAmount`, integer cents), which it does today by going through `computePaymentShares` from `@ardoise/shared`.

Local dev: `db:seed` gets the new behaviour. `db:fresh` still drops the volume, so it wipes accounts too, which is what "fresh" means.

### Operations

From the tailnet, `ssh rznn-hl`, then in `~/homelab/ardoise`:

- deploy the latest `main`: `docker compose pull && docker compose up -d` (also resets the demo data when the backend image changed),
- see what is running: `docker compose images`,
- reset the demo data: `docker compose restart backend` (the entrypoint re-seeds),
- start from nothing, accounts included: `docker compose down -v && docker compose up -d`. Also the way out if a migration ever breaks on existing accounts,
- SQL shell: `docker compose exec db psql -U ardoise`.

## Sequencing

`feat/payments` (37 commits ahead of `main`) rewrites `seed-dev.ts` and adds `db:fresh`. The seed change is built on top of that version, so `feat/payments` merges first. The rest (images, CI, homelab) is independent of it.

## Left to the builder

- How migrations run in the image (`drizzle-kit migrate` or Drizzle's runtime migrator), and how the backend waits for Postgres.
- Dockerfile structure: multi-stage, `pnpm deploy` or not, base images (pinned), where the Dockerfiles live.
- How `@ardoise/shared` gets built inside the image.
- Name and shape of the secure-cookie config.
- Test coverage of the seed: a backend e2e spec against a testcontainers Postgres that checks real accounts survive and the fictional data is rebuilt is welcome. No Playwright scenario: this slice has no user-facing flow.

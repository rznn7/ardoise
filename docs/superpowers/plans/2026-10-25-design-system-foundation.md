# Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Ink design system in place (tokens, theme, typeface, building blocks, backdrops, lint, screenshot and A/B tooling) and move the four existing screens onto it, with no behavior change. Also set up Playwright full-stack e2e scenarios for the existing use cases.

**Architecture:**
- Tailwind v4 serves only design-system tokens: the default palette is removed and the colors are registered from `styles.css`.
- App-level building blocks live in `src/app/shared/ui/`, next to spartan helm in `libs/ui/`. Feature templates assemble the two, and lint forbids anything else.
- Backdrops come from a seeded Node script that reads one palette source. The WebP files and a generated CSS token file are committed.

**Tech Stack:**
- Angular 22: standalone components, signals, `@angular/build:unit-test` running Vitest with jsdom, and Testing Library.
- spartan 1.8 helm, Tailwind 4, Figtree via `@fontsource-variable/figtree`.
- `@napi-rs/canvas` and `tsx` for the backdrop generator; `eslint-plugin-better-tailwindcss` 4.x for lint.
- Playwright (`@playwright/test`) in a new `apps/e2e` workspace, for screenshots and full-stack e2e with testcontainers Postgres and a CDP virtual authenticator.

**Spec:** `docs/superpowers/specs/2026-10-25-design-system-and-workflow-design.md`

## Global Constraints

- Work on branch `feat/design-system-foundation`, never `main`.
- Commit messages are a single line: no body, no trailers.
- No code comments.
- No behavior change on existing screens; existing specs keep passing, adjusted only where markup changes.
- Before any task is called done: `pnpm --filter @ardoise/frontend typecheck`, `test` and `lint` all pass. Vitest does not typecheck.
- Feature templates (`src/app/**` outside `src/app/shared/ui/**`):
  - Tailwind utilities for layout and spacing only.
  - Theme color classes are allowed.
  - No type-scale, font-weight, tracking or leading classes; text goes through text building blocks.
  - No arbitrary values (`[...]`), no component `.css` files, no inline styles.
- Only design-system colors exist: the default palette is removed with `--color-*: initial`. `black` and `white` stay registered, because helm's sheet overlay uses `bg-black/10`.
- Grain is "medium": amplitude 26, scaled `× (0.7 + 0.6 × luminance)`. There is no sparkle pass.
- Backdrop shapes are `converge`, `sunrise` and `diagonal`. Palettes are `violet`, `cobalt`, `sunset` and `ember`, with the exact hex values in the spec.
- Mobile layout is fluid 360–430 wide and full bleed, with the width capped from the `sm` breakpoint (640px). Tap targets are at least 44px.
- Theme preference is `'system' | 'light' | 'dark'`. It's stored in `localStorage` under key `ardoise.theme`, defaults to `'system'`, and the system option follows `prefers-color-scheme` live.

## Review Focus

1. **Storage unavailable or corrupted:**
   - When `localStorage` throws (private mode) or holds garbage under `ardoise.theme`, the app falls back to the system theme without errors.
   - Covered by Task 2 (`ThemeService` specs) and by the pre-boot script's try/catch.
2. **OS theme flips while the app is open with preference `system`:** the theme follows live without a reload. Covered by Task 2.
3. **Narrow screen (360px) with long group names or large amounts:** names truncate with an ellipsis, and the amount and trailing slot never wrap or get pushed off screen. Covered by Task 4 (`ListRow` spec asserts `min-w-0` + `truncate` on the primary text and `shrink-0` on the trailing slot).
4. **Backdrop image fails or is slow to load:** text on a backdrop stays readable because the container paints the palette's dark base color first. Covered by Task 6 (`BackdropSurface` spec asserts the base-color class is present before the image loads).
5. **Odd money values:** zero, negative, millions, and non-EUR currencies (CHF, GBP) format correctly, with a real minus sign and no float drift. Covered by Task 3 (`MoneyAmount` specs).

---

### Task 1: Branch, docs and workflow

**Files:**
- Create: `docs/design.md`
- Modify: `CLAUDE.md`, `docs/roadmap.md`
- Commit as well: the already-written `CLAUDE.md`, `docs/domain.md` (renamed from `stack-and-domain.md`), `docs/roadmap.md` edits, the deleted monorepo plan, the spec, and this plan.

**Interfaces:**
- Produces: `docs/design.md`, the file every later UI task (and future features) reads. Section headings:
  - `Visual direction`
  - `UX principles`
  - `Layout`
  - `Building blocks`
  - `Template rules`
  - `Backdrops`
  - `Workflow`
  - `A/B decisions log` (empty table: date, screen, picked, why)

- [ ] **Step 1:** `git switch -c feat/design-system-foundation`.
- [ ] **Step 2:** Write `docs/design.md`, distilled from the spec as the living reference. Keep the spec's exact values: palettes, grain, sizes, rules, tap-count rule, the add-expense reference flow, and the A/B workflow. Building-block names are left as a list to be filled in by Tasks 3–6.
- [ ] **Step 3:** In `CLAUDE.md`:
  - Add a `## UI` section with the template rules from Global Constraints and a pointer to `docs/design.md`.
  - Replace `## Workflow` with the five workflow steps from the spec (feature slices, spec checkpoint, A/B toggle, build without stopping, PR with screenshots).
  - Update the Layout block's `docs/` line to mention `design.md`.
- [ ] **Step 4:** Regroup `docs/roadmap.md` into feature slices:
  - "Design system foundation" (this plan).
  - "Payments": payment list + group page + add-payment form + feed.
  - "Balances": net balance + simplification + endpoint + view.
  - "Settlement".
  - "Real-time".
  - "Personal settings": theme selector, new.
  - "Hardening & ship": deploy, PWA manifest and installability, iOS keyboard handling, multi-device passkey, recovery.

  Keep the existing done/undone state and bullet text as sub-items.
- [ ] **Step 5:** Commit: `git add -A CLAUDE.md docs && git commit -m "docs: design system spec, plan, and feature-slice roadmap"`.

---

### Task 2: Ink tokens, Figtree, theme service

**Files:**
- Modify: `apps/frontend/src/styles.css`, `apps/frontend/src/index.html`, `apps/frontend/src/app/app.config.ts`, `apps/frontend/package.json`
- Create: `apps/frontend/src/app/shared/theme/theme.service.ts`, `apps/frontend/src/app/shared/theme/theme.service.spec.ts`

**Interfaces:**
- Produces:
  - `type ThemePreference = 'system' | 'light' | 'dark'`
  - `@Injectable({ providedIn: 'root' }) class ThemeService` with:
    - `readonly preference: Signal<ThemePreference>`
    - `readonly resolved: Signal<'light' | 'dark'>`
    - `setPreference(pref: ThemePreference): void`
  - It toggles class `dark` on `document.documentElement` from `resolved`.
  - `THEME_STORAGE_KEY = 'ardoise.theme'`.
  - Tokens available to every later task:
    - `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`
    - `primary`, `primary-foreground`, `secondary`, `secondary-foreground`
    - `muted`, `muted-foreground`, `accent`, `accent-foreground`
    - `destructive`, `border`, `input`, `ring`
    - `balance-positive`, `balance-negative`, `black`, `white`

- [ ] **Step 1: Write failing specs** in `theme.service.spec.ts`. Stub `matchMedia` with a controllable `MediaQueryList` fake.
  - `defaults to system and resolves from prefers-color-scheme`: with no stored value and the media query matching dark, `preference()` is `'system'`, `resolved()` is `'dark'`, and `<html>` has class `dark`.
  - `follows the system live when preference is system`: flip the fake's `matches` to false and dispatch `change`, then `resolved()` is `'light'` and the class is removed.
  - `stored preference wins over system`: with `localStorage['ardoise.theme'] = 'light'` and the system dark, `resolved()` is `'light'`.
  - `setPreference persists and applies`: `setPreference('dark')` leads to `localStorage['ardoise.theme'] === 'dark'` and the class `dark` being present.
  - `ignores garbage in storage`: with stored `'purple'`, `preference()` is `'system'`.
  - `survives storage that throws`: with `getItem` and `setItem` throwing, the service still resolves from system and `setPreference` doesn't throw.
- [ ] **Step 2:** Run `pnpm --filter @ardoise/frontend test`. Expected: the ThemeService specs FAIL (module not found).
- [ ] **Step 3: Implement `ThemeService`** with signals plus an `effect` that writes the class. Read and write storage inside try/catch. Inject it eagerly through `provideAppInitializer(() => inject(ThemeService))` in `app.config.ts`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Pre-boot script in `index.html`.**
  - Remove `class="dark"` from `<html>` and set `<title>Ardoise</title>`.
  - Add an inline `<script>` in `<head>` that reads `ardoise.theme` in a try/catch and adds `dark` when the value is `'dark'`, or when it's `'system'`/missing and `matchMedia('(prefers-color-scheme: dark)').matches`.
- [ ] **Step 6: Tokens in `styles.css`.**
  - Add `@theme { --color-*: initial; --color-black: #000; --color-white: #fff; }` before the inline theme.
  - Replace the `:root` and `:root.dark` values with Ink. Light anchors: background `#ffffff`, foreground `#0d0d0c`, muted-foreground `#5c5957`, secondary/muted/accent `#f5f5f4`, border/input `#e7e6e4`, primary `#0d0d0c`, primary-foreground `#ffffff`, ring `#0d9ad8`.
  - Dark uses a warm near-black background (≈`#121110`), foreground ≈`#f4f3f1`, primary ≈`#f4f3f1`.
  - Express values in oklch, matching the file's existing style.
  - Drop all `--sidebar-*` tokens.
  - Keep `--balance-positive: #14b86a` and `--balance-negative: #f0483c` (dark: slightly lighter).
- [ ] **Step 7: Figtree.**
  - `pnpm --filter @ardoise/frontend add @fontsource-variable/figtree@5.3.0`.
  - `@import '@fontsource-variable/figtree';` in `styles.css`.
  - `--font-sans: 'Figtree Variable', system-ui, sans-serif;`
- [ ] **Step 8:** Run `pnpm --filter @ardoise/frontend build`. Expected: success, and the CSS has no `--color-red-500`.
- [ ] **Step 9:** Run typecheck, test and lint for the frontend, then commit: `feat(frontend): ink tokens, figtree, and persisted theme preference`.

---

### Task 3: Text, money and balance building blocks

**Files:**
- Create in `apps/frontend/src/app/shared/ui/`:
  - `text/text.ts`, `text/text.spec.ts`
  - `money-amount/money-amount.ts`, `money-amount/money-amount.spec.ts`
  - `balance-indicator/balance-indicator.ts`, `balance-indicator/balance-indicator.spec.ts`

**Interfaces:**
- Consumes: the tokens from Task 2.
- Produces:
  - **Text directives** (attribute, `classes()` from `@spartan-ng/helm/utils`, same pattern as helm typography), exported as `AppTextImports`:
    - `[appTitle]` → `text-xl font-medium tracking-tight`
    - `[appBody]` → `text-sm leading-relaxed`
    - `[appMeta]` → `text-xs text-muted-foreground`
    - `[appError]` → `text-sm text-destructive`
    - `[appEyebrow]` → `text-xs font-medium uppercase tracking-wider`
    - `[appFigure]` → `text-4xl font-light tracking-tighter tabular-nums`
  - `<app-money-amount [cents]="number" [currency]="string" [signed]="boolean = false" />`
    - Renders `Intl.NumberFormat('en', { style: 'currency', currency })` of `cents / 100`.
    - Adds the `tabular-nums` class.
    - When `signed`, prefixes `+` for positive values and uses U+2212 `−` for negative values.
  - `<app-balance-indicator [cents]="number" [currency]="string" />`
    - A 6px dot (`bg-balance-positive` / `bg-balance-negative`, no dot at zero) followed by `<app-money-amount signed>`.

- [ ] **Step 1: Write failing specs.**
  - `money-amount.spec.ts`:
    - `formats cents as currency`: `cents=4250, currency='EUR'` renders `€42.50`.
    - `zero`: `0` renders `€0.00`.
    - `negative uses a true minus when signed`: `-4370, signed` renders `−€43.70`.
    - `positive gets a plus when signed`: `8620, signed` renders `+€86.20`.
    - `large values group thousands`: `124250050` renders `€1,242,500.50`.
    - `other currencies`: `CHF` renders text containing `CHF` and `42.50`; `GBP` renders `£42.50`.
    - `uses tabular figures`: the host has class `tabular-nums`.
  - `balance-indicator.spec.ts`:
    - `positive shows a positive dot`: an element with class `bg-balance-positive` exists.
    - `negative shows a negative dot`.
    - `zero shows no dot`.
  - `text.spec.ts`: a host template using each directive. Asserts `[appFigure]` has `tabular-nums` and `font-light`, `[appMeta]` has `text-muted-foreground`, and `[appError]` has `text-destructive`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the three, with `ChangeDetectionStrategy.OnPush` and signal `input.required`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Typecheck, lint, then commit: `feat(frontend): text, money amount, and balance indicator building blocks`.

---

### Task 4: Helm components, page state, list row

**Files:**
- Generate in `apps/frontend/libs/ui/`: `skeleton`, `empty`, `item`, `field`, `input`, `label`, `native-select`, `badge`, `separator`, `toggle-group`, `sonner`, `dialog`, `drawer`, `typography`. The generator updates `tsconfig.json` paths.
- Create in `apps/frontend/src/app/shared/ui/`:
  - `page-state/page-state.ts`, `page-state/page-state.spec.ts`
  - `list-row/list-row.ts`, `list-row/list-row.spec.ts`

**Interfaces:**
- Consumes: `AppTextImports` (Task 3).
- Produces:
  - **`<app-page-state>`** with inputs:
    - `state: 'loading' | 'empty' | 'error'`
    - `title: string` (empty/error)
    - `description: string` (optional)
    - `skeletonRows: number = 4`

    Output: `retry: void` (error only). Content projection `[appPageStateAction]` provides the empty-state action.
    - **loading:** renders `skeletonRows` row-shaped `hlm-skeleton` items inside a container with `role="status"` and `aria-label="Loading"`.
    - **empty:** uses helm `empty`.
    - **error:** shows the title, the description, and an outline `Retry` button that emits `retry`.
  - **`<app-list-row>`** with:
    - leading slot `[appListRowLeading]`,
    - primary text via `<span appListRowTitle>`,
    - meta line via `[appListRowMeta]`,
    - trailing slot `[appListRowTrailing]`.

    Built on helm `item`, with a minimum height of 44px.

- [ ] **Step 1: Generate the helm libs.** Run `pnpm --filter @ardoise/frontend exec ng g @spartan-ng/cli:ui <name>` for each lib listed, accepting the defaults from `components.json`. Then run `pnpm --filter @ardoise/frontend typecheck`. Expected: PASS.
- [ ] **Step 2: Write failing specs.**
  - `page-state.spec.ts`:
    - `loading exposes a status with skeleton rows`: `getByRole('status', { name: 'Loading' })` exists, with 4 skeleton children by default.
    - `empty shows title and projected action`.
    - `error shows title and emits retry on click`.
  - `list-row.spec.ts`:
    - `projects title, meta, leading and trailing`.
    - `title truncates and trailing never shrinks`: the title element has `truncate`, its wrapper has `min-w-0`, and the trailing wrapper has `shrink-0`.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement both.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6:** Typecheck, lint, then commit: `feat(frontend): helm components, page state, and list row`.

---

### Task 5: Full-bleed mobile shell

**Files:**
- Move: `src/app/shared/mobile-shell/` → `src/app/shared/ui/mobile-shell/` (the component, template and spec). Update the imports in `home.ts`, `auth-layout.ts` and `accept-invite.ts`.
- Modify: `mobile-shell.ts`, `mobile-shell.html`, `mobile-shell.spec.ts`

**Interfaces:**
- Produces: the same `MobileShellImports` API (`appShellHeader`, `appShellFab`, default slot), plus a new input `bleed: boolean = false`. When it's true, the safe-area top padding is not applied, so a backdrop can run under the status bar.

- [ ] **Step 1: Add failing specs.**
  - `is full width on phones`: the inner container has `w-full` and has no `border-x` and no `shadow-sm`.
  - `caps width from sm`: the inner container has `sm:max-w-md`.
  - `bleed removes top safe-area padding`: with `bleed`, the host has no `pt-[env(safe-area-inset-top)]`.
- [ ] **Step 2:** Run the tests. Expected: the new specs FAIL.
- [ ] **Step 3:** Implement:
  - Remove `max-w-[420px]`, `border-x`, `border-border` and `shadow-sm`.
  - Add `sm:max-w-md`.
  - Make the top safe-area padding a host class binding that's off when `bleed` is set.
- [ ] **Step 4:** Run the tests. Expected: PASS, including the 4 existing specs.
- [ ] **Step 5:** Typecheck, lint, then commit: `refactor(frontend): full-bleed mobile shell in shared ui`.

---

### Task 6: Backdrop generator, images, surface and group mark

**Files:**
- Create in `apps/frontend/src/app/shared/ui/backdrop/`:
  - `backdrop-palettes.ts`
  - `backdrop-for.ts`, `backdrop-for.spec.ts`
  - `backdrop-surface.ts`, `backdrop-surface.spec.ts`
  - `group-mark.ts`, `group-mark.spec.ts`
- Create in `apps/frontend/scripts/backdrops/`: `generate.ts`, `render.ts`, `rng.ts`
- Generated and committed: `apps/frontend/public/backdrops/{palette}-{shape}-{seed}.webp` (24 files) and `apps/frontend/src/styles/backdrop-tokens.css`
- Modify: `apps/frontend/package.json` (script `backdrops`, devDeps `@napi-rs/canvas@1.0.13` and `tsx` pinned to the backend's version), `apps/frontend/src/styles.css` (import `./styles/backdrop-tokens.css`)

**Interfaces:**
- Produces:
  - In `backdrop-palettes.ts`:
    - `type BackdropPalette = 'violet' | 'cobalt' | 'sunset' | 'ember'`
    - `type BackdropShape = 'converge' | 'sunrise' | 'diagonal'`
    - `BACKDROP_SEEDS = [1, 2] as const`
    - `BACKDROP_PALETTES: Record<BackdropPalette, { base: [string, string]; rays: string[]; hi: string }>`, with values copied verbatim from the spec.
  - In `backdrop-for.ts`:
    - `backdropFor(groupId: number): { palette; shape; seed }`. The palette is `PALETTE_ORDER[mod(groupId, 4)]` with `PALETTE_ORDER = ['violet','cobalt','sunset','ember']`. Shape and seed come from a small integer hash of `groupId`.
    - `backdropUrl(b): string` returns `/backdrops/${palette}-${shape}-${seed}.webp`.
  - `backdrop-tokens.css` (generated) defines `--color-backdrop-{palette}` = `base[0]` inside `@theme`, giving classes `bg-backdrop-violet` and so on.
  - `<app-backdrop-surface [palette] [shape] [seed]>`, or `[groupId]` as an alternative to the three. The host:
    - is `relative isolate overflow-hidden` with class `bg-backdrop-{palette}`,
    - renders an `<img alt="" aria-hidden="true">` covering it (`absolute inset-0 size-full object-cover -z-10`),
    - projects its content and uses white text.
  - `<app-group-mark [groupId]>`: a 28px rounded-md tile showing the group's backdrop image, cropped by `object-cover`, decorative (`aria-hidden`).
  - `pnpm --filter @ardoise/frontend backdrops` writes the 24 WebP files at 860×1864 (portrait, 2× of 430×932, cropped as needed by `object-cover`) plus `backdrop-tokens.css`.

- [ ] **Step 1: Write failing specs.**
  - `backdrop-for.spec.ts`:
    - `palette cycles by id`: ids 1, 2, 3, 4 give cobalt, sunset, ember, violet.
    - `deterministic`: `backdropFor(42)` deep-equals `backdropFor(42)`.
    - `always in range for odd ids`: for `[0, -7, 2_147_483_647]`, the palette is in `BACKDROP_PALETTES`, the shape is one of the three, and the seed is in `BACKDROP_SEEDS`.
    - `url format`: `backdropUrl({ palette: 'violet', shape: 'sunrise', seed: 2 })` is `/backdrops/violet-sunrise-2.webp`.
  - `backdrop-surface.spec.ts`:
    - `paints base color before image loads`: the host has `bg-backdrop-violet`.
    - `image is decorative`: the img has `alt=""`.
    - `groupId selects the group backdrop`: `[groupId]=3` sets the img src to `backdropUrl(backdropFor(3))`.
  - `group-mark.spec.ts`: `renders the group backdrop tile hidden from assistive tech`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement `backdrop-palettes.ts`, `backdrop-for.ts`, `BackdropSurface` and `GroupMark`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Generator.**
  - `rng.ts`: `mulberry32(seed: number): () => number`.
  - `render.ts`: `renderBackdrop(ctx, w, h, palette, shape, rng): void`, porting the approved algorithm below.
  - `generate.ts`: loops palettes × shapes × seeds, seeds the RNG with `hash(palette, shape, seed)`, encodes WebP at quality 82, and writes `backdrop-tokens.css` from `BACKDROP_PALETTES`.
  - Script: `"backdrops": "tsx scripts/backdrops/generate.ts"`.

  Algorithm (approved in the visual companion; not determined by the signatures):

  ```
  base: vertical linear gradient base[0] → base[1]
  origin: converge (w·U(.4,.6), −h·U(.5,1.2)) | sunrise (w·U(−.1,.15), h·U(1.3,1.8)) | diagonal (−4w, −6h)
  60 rays, compositing 'screen'; per ray:
    end point: converge (U(−.6w,1.6w), 1.1h) | sunrise (t=U(0,1): (1.2w·t − .1w, −.2h − (1−t)·.5h)) | diagonal (t=U(−.4,1.4): (w·t + .6h, 1.2h))
    endWidth U(4,70)·scale; tipWidth endWidth·U(.02,.15) (diagonal: endWidth·U(.8,1), far end = end − dir·8·hypot(w,h)·.2)
    blur U(0,7)·scale px, alpha U(.12,.6), color hi with p=.08 else random ray color
    quad: end ± normal·endWidth/2 → origin ± normal·tipWidth/2
  glow: radial gradient at origin clamped to canvas, radius .5w, hi → transparent, alpha .5
  grain: per pixel n = (U−.5)·26·(0.7 + 0.6·lum); add n to r,g,b
  scale = w / 340
  ```

- [ ] **Step 6:** Run `pnpm --filter @ardoise/frontend backdrops`. Expected: 24 files in `public/backdrops/`, each under 400 KB, plus `src/styles/backdrop-tokens.css`. Open two of them and compare by eye with the approved violet medium-grain mockup.
- [ ] **Step 7:** Build, typecheck, test and lint, then commit: `feat(frontend): seeded backdrop generator, images, backdrop surface, and group mark`.

---

### Task 7: Dev-only A/B variant toggle

**Files:**
- Create:
  - `src/environments/environment.ts` (`{ variants: true }`) and `src/environments/environment.prod.ts` (`{ variants: false }`)
  - `src/app/shared/variants/variant.service.ts`, `variant.service.spec.ts`
  - `src/app/shared/variants/variant-toggle.ts`, `variant-toggle.spec.ts`
- Modify:
  - `angular.json`: production `fileReplacements` swaps the environment file.
  - `src/app/app.ts` and `app.html`: render `<app-variant-toggle />` only when `environment.variants` is true.
  - `docs/design.md`: a "How to add an A/B fork" subsection.

**Interfaces:**
- Produces:
  - `type Variant = 'a' | 'b'`
  - `VariantService` (providedIn root) with:
    - `register(key: string, label: string): void`
    - `variant(key: string): Signal<Variant>` (defaults to `'a'`, persisted to `localStorage['ardoise.variant.' + key]` with try/catch)
    - `toggle(key: string): void`
    - `readonly registered: Signal<{ key: string; label: string }[]>`
  - `<app-variant-toggle>`: a fixed bottom-left pill listing registered keys. Each shows its label and an A/B segmented control. It renders nothing when nothing is registered.
  - Usage in a feature: `variants.register('add-expense', 'Add expense form')`, then `@if (variants.variant('add-expense')() === 'b') { … } @else { … }`.

- [ ] **Step 1: Write failing specs.**
  - `variant.service.spec.ts`:
    - `defaults to a`.
    - `toggle flips and persists`: after `toggle`, the value is `'b'` and storage holds `'b'`.
    - `restores persisted value`.
    - `survives storage that throws`.
  - `variant-toggle.spec.ts`:
    - `renders nothing with no registered variants`.
    - `shows a control per registered key and toggles on click`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The pill may use any token and type utility, since it lives in `shared/`. The lint exemption in Task 10 covers `src/app/shared/variants/**` as well.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Run `pnpm --filter @ardoise/frontend build`, then `grep -rl "app-variant-toggle" dist/`. Expected: no match, since it's absent from the production bundle.
- [ ] **Step 6:** Typecheck, lint, then commit: `feat(frontend): dev-only a/b variant toggle`.

---

### Task 8: Login and accept-invite on full-screen backdrops

**Files:**
- Modify:
  - `src/app/auth/auth-layout/auth-layout.{ts,html}`
  - `src/app/auth/login/login.{ts,html}`
  - `src/app/invite-link/accept-invite/accept-invite.{ts,html}`
  - their existing specs, where queries depend on removed card markup
- Delete: `auth-layout.css` and `login.css`, and their `styleUrl`.

**Interfaces:**
- Consumes: `MobileShellImports` with `bleed` (Task 5), `BackdropSurface` (Task 6), `AppTextImports` (Task 3), helm button.
- Layout, both screens:
  - `<app-mobile-shell bleed>` wraps a full-height `<app-backdrop-surface palette="violet">` (`sunrise` for login, `converge` for accept-invite, seed 1).
  - The wordmark "ardoise" sits top-left and respects the safe-area top through padding inside the surface.
  - Content is a bottom-aligned column with 16px side padding, with bottom padding respecting the safe area.
  - The `hlmCard` wrappers go away.
  - Buttons are `size="lg"`. Primary is white-on-dark inverted: helm `variant="secondary"` if its tokens give white on this surface, otherwise a new `inverted` variant added to helm button's cva in `libs/ui/button`. Secondary is an outline with white text.
- Copy:
  - Login: `[appFigure]` "ardoise" plus `[appBody]` "Split expenses with friends.".
  - Accept-invite (`loggedIn`/`loggedOut`): `[appEyebrow]` "You're invited to" plus `[appFigure]` group name.
  - All other states and texts unchanged.

- [ ] **Step 1:** Run the existing `login`, `accept-invite` and `auth-layout`-related specs. Expected: PASS (baseline).
- [ ] **Step 2:** Restructure the templates as above, keeping every state branch and every button label identical.
- [ ] **Step 3:** Run the specs. Expected: PASS. Fix only selectors that relied on card markup, never assertions on behavior or copy.
- [ ] **Step 4:** Run `pnpm dev` and open `/login` and `/join?token=<seed token>` at 393×852 in light and dark. Text should be readable, the buttons reachable, and nothing hidden under the status bar or home indicator.
- [ ] **Step 5:** Typecheck, lint, then commit: `feat(frontend): full-screen violet backdrop on login and accept-invite`.

---

### Task 9: Home and create-group sheet on building blocks

**Files:**
- Modify:
  - `src/app/home/home/home.{ts,html,spec.ts}`
  - `src/app/expense-group/create-group-sheet/create-group-sheet.{ts,html,spec.ts}`
- Delete: `home.css` and its `styleUrl`.

**Interfaces:**
- Consumes: `PageState`, `ListRow` (Task 4), `GroupMark` (Task 6), `AppTextImports`, helm `field`, `input`, `label` and `native-select`.
- Home:
  - Header uses `[appTitle]` "Groups".
  - loading/error/empty use `<app-page-state>`. Empty copy: "No groups yet" / "Create a group to start splitting expenses with friends.", with the projected action "Create your first group". Error copy: "Couldn't load your groups" / "Check your connection and try again.".
  - Each group row is an `<app-list-row>` with leading `<app-group-mark [groupId]="group.id">`, the title set to the group name, and trailing `<span data-testid="balance-slot"></span>`.
  - The FAB becomes a near-black primary pill (`hlmBtn`, default variant, `size="lg"`) with text "New group" and `aria-label="Create a group"`.
- Create-group sheet:
  - The raw `<input>`, `<select>` and `<label>` elements become helm field, input, native-select and label.
  - Error text uses `[appError]`.
  - Logic and copy are unchanged.

- [ ] **Step 1:** Update the home spec `shows a spinner while groups load`: rename it to `shows a loading skeleton while groups load` and assert `getByRole('status', { name: 'Loading' })`. Keep everything else.
- [ ] **Step 2:** Run the tests. Expected: the renamed spec FAILS.
- [ ] **Step 3:** Restructure both templates.
- [ ] **Step 4:** Run the tests. Expected: all home and create-group-sheet specs PASS. Adjust queries only where label association changed, never the behavior asserted.
- [ ] **Step 5:** Typecheck, lint, then commit: `feat(frontend): home and create-group sheet on design system building blocks`.

---

### Task 10: Enforce template rules in lint

**Files:**
- Modify: `apps/frontend/eslint.config.js`, `apps/frontend/package.json`
- Create: `apps/frontend/scripts/check-component-css.ts`

**Interfaces:**
- Produces:
  - Lint failures for rule violations in feature templates (`src/app/**/*.html`, plus inline templates and host classes in `src/app/**/*.ts`), excluding `src/app/shared/ui/**` and `src/app/shared/variants/**`.
  - A `lint` script that also runs the CSS check.

- [ ] **Step 1:** `pnpm --filter @ardoise/frontend add -D eslint-plugin-better-tailwindcss@4.10.0`.
- [ ] **Step 2: Configure** following the plugin's Angular parser docs, with `entryPoint: 'src/styles.css'`:
  - `better-tailwindcss/no-unknown-classes`: error. This fails on raw palette colors because they no longer exist.
  - `better-tailwindcss/no-conflicting-classes` and `no-duplicate-classes`: error.
  - `better-tailwindcss/no-restricted-classes`: error, with these patterns:
    - `\[` (arbitrary values)
    - `^text-(xs|sm|base|lg|xl|[2-9]xl)$`
    - `^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$`
    - `^tracking-`
    - `^leading-`

    Each pattern gets a message that points to `docs/design.md#template-rules`.
  - Apply `no-restricted-classes` only to feature files (the globs above). Apply the other three everywhere under `src/`.
- [ ] **Step 3: `check-component-css.ts`.**
  - Fails, printing the paths, if any `src/app/**/*.css` file exists outside `src/app/shared/ui/**`.
  - Fails if any component outside `shared/ui` declares `styleUrl` or `styles`.
  - Wire it as `"lint": "eslint src && tsx scripts/check-component-css.ts"`.
- [ ] **Step 4:** Run `pnpm --filter @ardoise/frontend lint`. Expected: PASS on the refactored code. If anything fails, fix the template, never the rule.
- [ ] **Step 5: Prove the rules bite.** Temporarily add `<p class="text-lg text-red-500 w-[13px]">x</p>` to `home.html` and create an empty `home.css`. Run lint and expect three ESLint errors plus the CSS check failure. Then revert both.
- [ ] **Step 6:** Commit: `chore(frontend): lint-enforce design system template rules`.

---

### Task 11: Playwright workspace and screenshot project

**Files:**
- Create the package `apps/e2e/` (`@ardoise/e2e`, private, `"type": "module"`):
  - `package.json`, `tsconfig.json`, `eslint.config.mjs` (modelled on `libs/shared`, minus the zod-only import rule)
  - `playwright.config.ts`
  - `screenshots/fixtures.ts`, `screenshots/matrix.ts`, `screenshots/capture.spec.ts`
- Modify: root `.gitignore` (add `apps/e2e/screenshots-out/`, `apps/e2e/test-results/`, `apps/e2e/playwright-report/`) and `docs/design.md` (a "Screenshots" subsection).

**Interfaces:**
- Consumes: `THEME_STORAGE_KEY` value `'ardoise.theme'` (Task 2; duplicate the string literal rather than importing Angular code), and `@ardoise/shared` types for typed fixtures.
- Produces:
  - Playwright `@playwright/test@1.64.1` with two projects in `playwright.config.ts`. Both use Chromium only.
    - `screenshots`: `testDir: 'screenshots'`, `baseURL: process.env.SCREENSHOTS_BASE_URL ?? 'http://localhost:4200'`, no webServer. The frontend must already be running via `pnpm dev:front`.
    - `e2e`: added in Task 12.
  - Scripts:
    - `"screenshots": "playwright test --project screenshots"`. With `ALL_SIZES=1` it adds the 360 and 375 sizes.
    - `"typecheck": "tsc --noEmit"`, `"lint": "eslint ."`.
  - Output: `apps/e2e/screenshots-out/{route}-{state}-{theme}-{w}x{h}.png`.
- **Decision:** screenshot API responses come from Playwright route interception (`page.route('**/api/**')`) using `fixtures.ts`, not from a seeded backend. Every state (loading = a never-fulfilled route, error = 500, empty, filled) becomes deterministic. This deviates on purpose from the spec's "seeded backend" wording, since the spec leaves the mechanism to the builder.
- **Matrix** (`matrix.ts`):
  - `login`: idle.
  - `join`: loading, loggedOut, loggedIn, invalid, couldNotLoad.
  - `home`: loading, empty, error, filled. Filled has 4 groups, one with a 40-character name.
  - `home-create-sheet`: form, invite.

  Themes are light and dark, set via `addInitScript` writing `localStorage['ardoise.theme']`. The size is 393×852, plus 360×780 and 375×667 when `ALL_SIZES=1`. `capture.spec.ts` generates one `test()` per cell. `/api/auth/me` returns a `MeResponse` for authenticated cells, and 401 for `login` and loggedOut `join`.

- [ ] **Step 1:** Scaffold the package and run `pnpm install`. Then run `pnpm --filter @ardoise/e2e exec playwright install chromium`. Expected: success.
- [ ] **Step 2:** Implement the config, fixtures, matrix and capture spec.
- [ ] **Step 3:** Run `pnpm dev:front` in the background, then `ALL_SIZES=1 pnpm --filter @ardoise/e2e screenshots`. Expected: one PNG per cell, all tests green, and no page console errors (the spec fails on `pageerror`).
- [ ] **Step 4:** Look at every 393 image, plus the 360 and 375 ones, against `docs/design.md`. Fix any defects in the owning building block and re-run.
- [ ] **Step 5:** Run typecheck and lint for `@ardoise/e2e`, then commit: `chore(e2e): playwright workspace with fixture-driven screenshot matrix`.

---

### Task 12: Full-stack e2e scenarios

**Files:**
- Create in `apps/e2e/`:
  - `e2e/global-setup.ts`, `e2e/global-teardown.ts`
  - `e2e/fixtures/test.ts`, `e2e/fixtures/passkey.ts`, `e2e/fixtures/db.ts`
  - `e2e/join-with-invite.spec.ts`, `e2e/login-logout.spec.ts`, `e2e/create-group-and-invite.spec.ts`, `e2e/invalid-invite.spec.ts`, `e2e/auth-guard.spec.ts`
  - `proxy.e2e.conf.json` (`/api` → `http://localhost:3100`, same pathRewrite as the frontend's)
- Modify:
  - `apps/e2e/playwright.config.ts`: add the `e2e` project with `testDir: 'e2e'`, `baseURL: 'http://localhost:4300'`, viewport 393×852, `globalSetup`, `globalTeardown`, `workers: 1`.
  - `apps/e2e/package.json`: `"test:e2e": "playwright test --project e2e"`, so the root `pnpm test:e2e` picks it up.
  - `.github/workflows/ci.yml`: rename the `backend-e2e` job to `e2e` and add `pnpm --filter @ardoise/e2e exec playwright install --with-deps chromium` before `pnpm test:e2e`.
  - `CLAUDE.md`: Commands and Testing sections.
  - `docs/design.md`: Workflow gets the rule that every feature slice adds or extends e2e scenarios for its use cases.

**Interfaces:**
- **`global-setup.ts`:**
  1. Starts a `PostgreSqlContainer('postgres:16-alpine')` from `@testcontainers/postgresql` (same version as the backend's).
  2. Runs Drizzle migrations from `../backend/src/shared/database/migrations`, the same way as `apps/backend/test/helpers/test-app.ts`.
  3. Builds the shared lib and the backend (`pnpm --filter @ardoise/backend... build`).
  4. Spawns the backend `node dist/main` with `DATABASE_URL`, `PORT=3100`, `RP_ID=localhost`, `RP_NAME=Ardoise`, `EXPECTED_ORIGIN=http://localhost:4300`, plus the other variables from `apps/backend/.env.example`.
  5. Spawns the frontend `ng serve --port 4300 --proxy-config ../e2e/proxy.e2e.conf.json` in `apps/frontend`.
  6. Waits for both to answer HTTP, then writes `DATABASE_URL` to `process.env` and stores the pids and container id for teardown.

  `global-teardown.ts` kills both processes and stops the container.
- **`fixtures/db.ts`:**
  - `resetDb(): Promise<void>` truncates every app table `RESTART IDENTITY CASCADE`, using the same table list as `apps/backend/scripts/seed-dev.ts`.
  - `seedGroupWithInvite(name: string): Promise<{ groupId: number; token: string }>` inserts an `expense_group` and a multi-use `invite_link`, expiring in 7 days, with a random 43-character base64url token.
- **`fixtures/passkey.ts`:** `addVirtualAuthenticator(page: Page): Promise<void>`.
  - Opens a CDP session, sends `WebAuthn.enable`, then `WebAuthn.addVirtualAuthenticator` with `{ protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true }`.
- **`fixtures/test.ts`:** exports `test` extending Playwright's with:
  - an auto fixture that calls `resetDb()` before each test,
  - a `passkeyPage` fixture: a page with a virtual authenticator attached,
  - `newUserPage()`: a fresh browser context, page and authenticator, for multi-user scenarios.

  Re-exports `expect`.

- **Scenarios.** Each test name reads as a use case, and assertions go through accessible roles and text, never CSS classes.
  - `join-with-invite.spec.ts`
    - `a newcomer joins a group from an invite link with a new passkey`:
      1. Seed "Lisbon trip" with an invite and go to `/join?token=…`. "Lisbon trip" is visible.
      2. Click "New here? Join with a passkey". The URL ends up at `/home`, with a row named "Lisbon trip".
  - `login-logout.spec.ts`
    - `a member logs out and back in with the same passkey and finds their groups`:
      1. Join as above.
      2. There's no logout control in the UI yet, so POST `/api/auth/logout` through `page.request`, which shares the context's cookies.
      3. Go to `/login`, click "Login with passkey". `/home` lists "Lisbon trip".
  - `create-group-and-invite.spec.ts`
    - `a member creates a group and a friend joins it from the shared link`:
      1. User A joins a seeded group, then creates "Flatshare" through the FAB and sheet and reads the invite URL from the readonly invite input.
      2. User B (`newUserPage()`) opens that URL and joins with a new passkey.
      3. B's home lists "Flatshare". After A reloads, A's home lists both groups.
  - `invalid-invite.spec.ts`
    - `an unknown invite link explains itself instead of failing`: `/join?token=` followed by 43 × `x` shows "This invite is no longer valid".
    - `an expired invite link explains itself`: seed, set `expires_at` in the past through `db.ts`, then expect the same message.
  - `auth-guard.spec.ts`
    - `a visitor without a session is sent to login`: `/home` redirects to `/login`.
    - `a member with a session skips the login page`: after joining, visiting `/login` redirects to `/home`.

- [ ] **Step 1:** Implement global setup and teardown plus the fixtures. Add one smoke test (`/login` shows "Login with passkey") and run `pnpm --filter @ardoise/e2e test:e2e`. Expected: PASS, with containers and processes cleaned up afterwards (`docker ps` shows no leftover postgres from this run).
- [ ] **Step 2:** Write the scenario specs and run them. Expected: all PASS. A failure means a real bug or a wrong selector. Fix real bugs in the app in a separate commit, and never weaken the assertion.
- [ ] **Step 3:** Remove the smoke test (the scenarios cover it). Update CI, `CLAUDE.md` (the commands list gains `pnpm --filter @ardoise/e2e test:e2e` and `screenshots`; Testing gains "user-facing flows are covered by Playwright scenarios in `apps/e2e/e2e`, with real backend, real Postgres and virtual passkeys"), and `docs/design.md`.
- [ ] **Step 4:** Run typecheck and lint for `@ardoise/e2e`, then commit: `test(e2e): full-stack playwright scenarios with virtual passkeys`.

---

### Task 13: Verify and open the PR

- [ ] **Step 1:** Run `pnpm verify`. Expected: PASS, including both backend e2e and Playwright e2e.
- [ ] **Step 2:** Run `ALL_SIZES=1 pnpm --filter @ardoise/e2e screenshots` against a fresh `pnpm dev:front`.
- [ ] **Step 3:** Push the branch and open a PR. The body includes:
  - the summary,
  - the building blocks added,
  - the e2e scenarios added,
  - the screenshots at 393 (light and dark side by side per state) uploaded into the body,
  - the 360 and 375 images only where they differ meaningfully.

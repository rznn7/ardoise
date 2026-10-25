# Design system, UX principles and workflow

## Why

The owner trusts the generated code on structure and conventions: those are well defined and enforced. The frontend is where things go wrong. Without a system, every new screen gets improvised, and improvisation shows up as one-off styling written per screen. The owner explicitly dislikes "writing a lot of custom CSS every time".

This document defines what is needed to build UI the owner accepts without screen-by-screen review:

- a closed design system that screens assemble instead of style,
- a visual direction and UX philosophy concrete enough to settle choices,
- a workflow with fewer, better-placed checkpoints.

It also defines the first slice that puts the foundation in place.

## Goals

- New screens are assembled from existing building blocks. Visual decisions live in tokens and building blocks, never in feature templates.
- The app looks like one deliberate thing: the "Ink" direction below, in light and dark.
- Common actions take very few touches, and the spec states the count.
- The owner reviews twice per feature, a spec before and a PR after, instead of reviewing each roadmap bullet.

## Non-goals

- Animations and motion ("giving life to the app"). Wanted later, explicitly not now.
- Tablet or desktop layouts. Mobile only for now, with a sane cap on large screens.
- Testing on a real phone. The owner tries things in a desktop browser's mobile view, so there's no HTTPS tunnel for now.
- New product features. The foundation slice only refactors existing screens.

## Anti-goals (failure even if it technically works)

- Feature templates carrying colors, arbitrary values (`[...]`), or component CSS files.
- Color used as decoration all over the screen.
- Gradients that look like a CSS template ("artificial"). The texture must read as light and film grain.
- Color that gives money a moral tone: no "ember means you owe".
- A form that makes you tap into each field to accept a default.

---

## Visual direction: Ink

The owner's references:

- **Payfit's design system:** strong black and white, color only in precise places, warm neutrals.
- **VoidZero websites:** simplicity, plus colorful abstract backgrounds with heavy grain, lines and light rays.

From both: "how thin and pure things can be".

### Base
- Near-black ink on white, with warm greys (Payfit-like: ink `#0d0d0c`, secondary text `#5c5957`, surface `#f5f5f4`, border `#e7e6e4`).
- Hairline (1px) borders, flat surfaces, few boxes. Lists are hairline-separated rows, not cards.
- Thin type. Font is **Figtree** (the owner's pick from eight specimens). It's a variable font with weights 300–900, under the SIL Open Font License 1.1, which allows free commercial use and self-hosting. Self-host it as `@fontsource-variable/figtree` rather than loading from Google at runtime: faster, and nothing goes to a third party. There's no monospace face. Amounts use Figtree's tabular figures (`tnum`, verified present in the font) via `tabular-nums`. Light (300) for large figures, regular for body, medium for names and labels.
- Primary buttons are near-black, with a slightly lighter hover. They are the strongest element on a screen.
- The current slate-blue `--primary` goes away.

### Color is rare and meaningful
- **Balances:** a small green or red dot next to an ink-colored amount. This is the only color tied to money.
- **One "moment" surface per screen, at most.** The screen's hero element (for example the overall balance on home, or the group header) sits on a generated backdrop: light rays plus heavy grain.
  - **Violet** is Ardoise's own color: login, accept-invite, and home overall balance.
  - **Violet, cobalt, sunset and ember** are **group identities**. Each group gets one automatically, so you recognise a group by its color. The group's color shows on its group-page hero and as a small mark next to its row on home. The mark is a **small rounded square** (a mini backdrop tile), never a dot, because dots are reserved for balances. *Builder's call.*
- Everything outside the moment surface and the balance dots stays black and white.

### Backdrops (the moment surfaces)
Approved in the visual companion. The mockup lived in a gitignored folder, so the description below is the complete reference.

- **Technique:**
  1. A vertical two-stop dark base.
  2. About 60 rays drawn as long tapering quads toward an origin point. Each ray gets a random width, a palette color (8% chance of the highlight color), alpha 0.12–0.6, blur 0–7px, and "screen" blending.
  3. A soft radial glow near the origin.
  4. Per-pixel monochrome grain.
- **Grain: "medium"**, amplitude 26, scaled `× (0.7 + 0.6 × luminance)`. No "sparkle" pass: brightening random pixels made visible dots, which the owner rejected.
- **Shapes:** `converge` (origin above the top edge), `sunrise` (origin below a bottom corner), `diagonal` (very distant origin, near-parallel streaks). `burst` was rejected.
- **Palettes** (base top → bottom, rays, highlight):
  - violet: `#16005a → #3a0bb8`, rays `#7b2cff #a52cff #5a1aff #e040ff #4a10e0`, hi `#7fe9ff`
  - cobalt: `#020a3a → #0a2a9a`, rays `#1f4dff #2f7bff #0f2fd0 #4aa8ff #1838e8`, hi `#8ff5ff`
  - sunset: `#2a0a2e → #5a1440`, rays `#ff5a5f #ff8a4a #ffb547 #d93a7a #ff6f91`, hi `#ffe7a8`
  - ember: `#0d0605 → #2a0c06`, rays `#ff4a1c #ff7a1c #d92a10 #ffa53a #b0200c`, hi `#ffe0a0`
- **Generated at dev time, not at runtime:**
  - A typed script in `apps/frontend/scripts/backdrops/` uses `@napi-rs/canvas` and a seeded RNG.
  - It runs via `pnpm --filter @ardoise/frontend backdrops`.
  - It writes WebP files to `apps/frontend/public/backdrops/`, and they are **committed**, like Drizzle migrations.
  - Same code and seeds give the same images. Byte-identical output across library versions is not promised, so there's no CI check for it.
  - The set is 4 palettes × 3 shapes × 2 seeds = 24 images, sized for a full-width phone hero at 2× density.
- **Group colors have one source** shared by the generator and the CSS tokens (the small mark on home), so they can't drift apart.
- **Group → palette assignment:** derived from the group id (`id mod 4` for the palette, and a hash of the id for shape and seed). That means no schema change. *Builder's call.* Storing the choice can come later if users get to change it.

### Dark mode
A real theme, maintained alongside light. Ink inverts cleanly: near-white text on a warm near-black background. Backdrops are dark-based and work unchanged. Every screen is screenshotted in both themes.

- **Which theme a user sees** is a personal setting with three choices: system (the default, following `prefers-color-scheme` live), light, or dark. The choice is saved in browser storage. A small pre-boot script in `index.html` reads it and sets the class before Angular starts, so there's no flash of the wrong theme. This replaces today's hard-coded `<html class="dark">`.
- There's no personal settings screen yet. The foundation slice builds the theme service, including the saved choice. The selector UI arrives with a personal settings page, which gets added to the roadmap.

---

## UX principles

1. **Common case first, tweaks after.** Flows open straight on what's always needed. Everything else starts on a sensible default, shown as something you can tap to change and never as a field to fill in.
2. **What you change most stays one tap away.** Usage decides, not form layout. For expenses the owner mostly changes the split, sometimes the payer.
3. **Few touches for important actions.** Every spec for a flow states the tap count for its common case.
4. **Clear at a glance.** One main figure per screen, everything else quieter. Amounts use tabular figures.
5. **Feels instant.** Skeleton rows instead of spinners. Optimistic updates for user actions such as saving an expense: the UI updates immediately, syncs in the background, and rolls back with a message if the server refuses.
6. **Mobile only, full screen real estate.** See layout below.

### Reference flow: add expense
This is the bar for "fast", and it gets specced properly in its own slice:

1. Tap the FAB. The amount is focused with the numeric keypad already up.
2. Type the amount. "Next" moves to the title, which is optional and falls back to a dated default.
3. Payer = me, date = today, split = equal between all members. The **members are visible inline as chips**, all selected; one tap leaves someone out. Payer and date are chips you change only when they're wrong. Percent, shares and exact amounts sit one level deeper.
4. Save: optimistic, back to the feed.

The common case takes 3–4 touches. Tricount takes about 10.

### Layout
- **Fluid from 360 to 430 wide, full bleed on phones.** Content padding is 16px. The width cap only applies from about 600px up, to avoid stretching on tablets and desktop. This replaces `MobileShell`'s current `max-w-[420px]`, side borders and shadow.
- Hero backdrops run edge to edge, under the status bar.
- Primary actions sit in the thumb zone. Tap targets are at least 44px.
- PWA on iOS and Android. *Builder's call:* the foundation slice only makes the layout ready (safe areas, full bleed). The manifest, icons, installability and iOS keyboard handling come with the add-expense slice, where the keyboard first matters.
  - Respect safe areas.
  - Account for standalone mode.
  - On iOS the keyboard overlays the page, so form actions must stay visible above it (via `visualViewport` or an equivalent).
- **Checked at three sizes:** 360×780 (Android, narrowest), 393×852 (iPhone 15/16, the main size), 375×667 (iPhone SE, short height plus keyboard).

---

## Building blocks (closed system)

In order of preference:

1. **spartan helm components** (shadcn ports, in `apps/frontend/libs/ui`).
2. **App-level building blocks** in `apps/frontend/src/app/shared/ui/`, for things helm doesn't cover. First set:
   - **money amount:** formatting, tabular, with sign, from cents plus currency.
   - **balance indicator:** the dot plus the amount.
   - **page state:** loading skeleton, empty, and error with retry. This replaces the duplicated markup in `home.html`.
   - **list row:** primary text, meta line, trailing slot.
   - **backdrop surface:** a hero or full-screen container that renders a backdrop image by palette key or group id.
   - **text:** title, body, meta and figure (large light numbers).

   *Exact names and APIs are the builder's call.*
3. **A new building block is a deliberate act.** It's created in `shared/ui/` and mentioned in the PR, never quietly inside a feature.

Rules for feature templates:
- Tailwind utilities are for **layout and spacing only**: flex and grid, gap, padding and margin from the scale, sizing.
- **Color classes are allowed, but only design-system colors exist.** Tailwind is configured to serve the design system:
  - In `styles.css` the default palette is removed (`--color-*: initial` in `@theme`).
  - Only token-backed colors are registered (`background`, `foreground`, `muted-foreground`, `primary`, `border`, balance and group colors, and so on).
  - Helm uses one raw color today (`bg-black/10`, the sheet overlay), so `black` and `white` stay registered or get mapped to an overlay token. *Builder's call.*
  - So `text-muted-foreground` works, and `text-red-500` doesn't exist. Tweaking a color means changing its token once, and every screen follows.
- **Typography goes through text building blocks** (title, body, meta, figure; *names are the builder's call*), not `text-lg font-semibold` in feature templates. Type is where screens drift most.
- No arbitrary values (`[...]`), no component `.css` files, no inline styles.
- Tokens live in `src/styles.css` (light plus `.dark`). Building blocks and helm may use any token and type utility.
- **Enforcement:** add `eslint-plugin-better-tailwindcss` (or the current equivalent) to the frontend ESLint config to forbid arbitrary values and unknown classes in templates, and add a lint rule or check that rejects non-empty component CSS files outside `libs/ui` and `shared/ui`. If a rule can't be expressed, write it in CLAUDE.md and say in the PR that it is unenforced.

Helm components to install, checked against what spartan 1.8 actually offers: field/form field, input, label, item, empty, skeleton, badge, separator, toggle-group, sonner (toast), dialog and/or drawer. Install what exists; for what doesn't, note it and use the closest equivalent.

---

## Workflow

1. **Slices are whole features.** One run covers backend, frontend and tests together. `docs/roadmap.md` gets regrouped into feature slices. For example, the rest of Phase 2 (payment list, group page, add-payment form, feed) is one slice.
2. **Checkpoint 1: spec.** A short spec covering screens, states, flows, edge cases, and the tap count for the main action. The owner approves or redirects before building starts.
3. **UX forks get two versions.** When a screen has a real fork, build both behind a **dev-only A/B toggle**: a small floating pill, present only in dev builds and absent from production bundles. The owner tries both in a desktop browser's mobile view. Before merge, the losing variant and the toggle are deleted, so `main` never carries variants. The pick and its reason go into `docs/design.md`.
4. **Build without stopping.** Plan, code, commits. Interrupt only for an unclear domain rule or a convention that would need breaking.
5. **Checkpoint 2: PR.**
   - `pnpm verify` is green.
   - Screenshots of **every screen in every state** (loading, empty, error, filled), **light and dark**:
     - the full set at 393×852,
     - 360×780 and 375×667 only where they differ meaningfully (the builder judges),
     - forks as side-by-side A/B.
   - Screenshots come from Playwright driving the real app against a seeded backend. They are reviewed by the builder before the PR is opened.

### Where this lives afterwards
- `docs/design.md`: the living design system and philosophy (visual direction, principles, building blocks, rules, the log of A/B picks).
- `CLAUDE.md`: a short UI section (rules plus pointer to `docs/design.md`) and the workflow.
- `docs/roadmap.md`: regrouped into feature slices.
- This spec stays as the record of the decision.

---

## First slice: foundation

Everything below, in one PR, following the workflow above:

1. Docs: `docs/design.md`, the CLAUDE.md UI and workflow sections, and the regrouped roadmap.
2. Tokens: Ink light and dark in `styles.css`, Figtree self-hosted, slate primary removed, balance tokens kept as dot colors, group palette tokens.
3. Helm components installed (list above).
4. App-level building blocks (first set above).
5. Lint enforcement for the template rules.
6. `MobileShell`: full bleed on phones, cap from about 600px, safe areas kept.
7. Backdrop generator plus the 24 committed images, plus the backdrop surface building block.
8. Screenshot tooling: a Playwright script that logs in through a seeded session, visits each route in each state, and writes PNGs for both themes and three sizes. States that are hard to reach (loading, error) may be forced through request interception.
9. The dev A/B toggle mechanism, built and documented but unused in this slice.
10. Refactor home, create-group sheet, accept-invite and login onto the system. No behavior change; the home spinner becomes a skeleton. Balances are Phase 3, so home gets **no hero in this slice**, only the small group-color mark on each row. Login and accept-invite become **full-screen violet backdrops** (owner's pick over a top band):
- The rays fill the whole screen, with the wordmark at the top.
- Content sits low in the thumb zone: an eyebrow line ("You're invited to"), the group name in large light type, then the buttons.
- Buttons invert: white primary, translucent outlined secondary.
- It looks the same in light and dark themes.
- Login uses a `sunrise` shape; accept-invite uses `converge`.
- The card wrapper (`auth-layout`, accept-invite's `hlmCard`) goes away.
- The inviter name and member avatars shown in the mockup need invite-preview API changes, so they're not in this slice. *Builder's call.*

## Left to the builder
- Names, APIs and file layout of app-level building blocks.
- Exact token values beyond the anchors above, including the dark-mode values.
- The exact Tailwind lint plugin and its configuration.
- How the Playwright script reaches each state, and where it lives.
- The seed scheme for backdrops and the image dimensions.
- How the A/B toggle is wired (query param, signal or service), as long as it is dev-only.

# Ardoise — Design system

The living reference for every screen. Read before building UI. Origin and rationale: `superpowers/specs/2026-10-25-design-system-and-workflow-design.md`.

## Visual direction

**Ink.** Near-black on white, warm greys, hairline borders, flat surfaces, thin type. References: Payfit's design system (strong black and white, color only in precise places, warm neutrals) and VoidZero's sites (simplicity, grainy abstract light). "Thin and pure."

- Typeface: **Figtree** (variable, 300–900, SIL OFL 1.1), self-hosted via `@fontsource-variable/figtree`. Amounts use its tabular figures (`tabular-nums`). Light for big figures, regular for body, medium for names and labels.
- Primary buttons are near-black (inverted in dark). They are the strongest element on a screen.
- Lists are hairline-separated rows, not cards.
- Color is rare and meaningful:
  - **Balances:** a small green/red dot next to an ink amount. The only color tied to money.
  - **One moment surface per screen, at most:** a backdrop (see Backdrops) behind the screen's hero element.
  - **Violet** speaks for Ardoise: login, accept-invite.
  - **Violet, cobalt, sunset, ember** are group identities, derived from the group id. A group's color appears on its hero, and on its home row as its backdrop fading in from the right edge behind the trailing content (amount), which is white over it. Never a dot: dots are for balances.
- Dark mode is a real theme, maintained alongside light. Preference `system | light | dark`, stored in `localStorage['ardoise.theme']`, default `system`.

## UX principles

1. **Common case first, tweaks after.** Flows open on what's always needed. Everything else starts on a sensible default shown as something to tap, never a field to fill.
2. **What you change most stays one tap away.** Usage decides, not form layout.
3. **Few touches for important actions.** Every flow spec states the tap count of its common case.
4. **Clear at a glance.** One main figure per screen; everything else quieter.
5. **Feels instant.** Skeletons, not spinners. Optimistic updates for user actions, rolled back with a message if the server refuses.
6. **Mobile only, full screen real estate.**

Reference flow, add payment (4 taps: **+ → Next → Next → Save**, amount and title typed in between). Full spec in `superpowers/specs/2026-10-26-payments-design.md`.

1. The app opens on the last group used (once per launch); its hero makes the group obvious.
2. **+** → amount, focused, numeric keypad up, group chip in the top bar. **Next**.
3. Title, optional, its placeholder is the dated default ("Payment, 26 Oct"). **Next**.
4. Options on one screen, prefilled: Paid by (native select, me), Date (native date, today), split Equally with everyone ticked. Shares / % / Exact sit in the same segmented control, inline on the member rows, no sub-screens.
5. **Save**, optimistic: back on the group page, the row shows "Saving…" until confirmed.

Animations come later, not now.

## Layout

- Fluid from 360 to 430 wide, full bleed on phones, 16px content padding. Width capped from the `sm` breakpoint.
- Backdrops run edge to edge, under the status bar.
- Primary actions in the thumb zone. Tap targets ≥ 44px.
- Floating actions (`appShellFab`) use `hlmBtn size="fab"`: 56px high, round when icon-only, a pill with text.
- PWA on iOS and Android: respect safe areas. Keyboard handling landed with the payments slice (`interactive-widget=resizes-content` in the viewport meta); standalone mode runs content under a translucent status bar (`apple-mobile-web-app-status-bar-style: black-translucent`), with the manifest scoped to `/`.
- Checked at 360×780, 393×852 (main), 375×667.

## Building blocks

Prefer in this order:

1. spartan helm components in `apps/frontend/libs/ui`.
2. App-level building blocks in `apps/frontend/src/app/shared/ui/`.
3. A new building block is a deliberate act: created in `shared/ui/` and called out in the PR, never inside a feature.

Current app-level blocks:

- `group-hero`: the group's backdrop with the top-bar actions and the group name over it (group page).
- `group-chip`: small chip with the group's colour and name, so the target group is always visible in the add/edit flow and details.
- `figure-input`: the large amount field (`appFigureInput`) of the add flow's first step.
- `stepper`: − / + with the value between, 44px buttons, for share weights.
- `balance-bar`: one member's balance as an ink bar on a centre axis, left when they owe, right when they're owed, scaled to the group's largest balance.

## Template rules

Applies to feature templates: everything in `src/app/**` outside `src/app/shared/ui/**` and `src/app/shared/variants/**`.

- Tailwind utilities for layout and spacing only: flex, grid, gap, padding, margin, sizing.
- Theme color classes are allowed. Only design-system colors exist: Tailwind's default palette is removed, so `text-red-500` does not exist. Change a color by changing its token.
- No type-scale, font-weight, tracking or leading classes. Text goes through text building blocks.
- No arbitrary values (`[...]`), no component `.css` files, no inline styles.
- Tokens live in `src/styles.css` (light and `.dark`).

## Backdrops

Generated light rays with heavy grain, VoidZero-inspired.

- Technique: a dark two-stop vertical base; ~60 tapering rays toward an origin, random width, palette color (8% highlight), alpha 0.12–0.6, blur 0–7px, screen blending; a soft radial glow at the origin; per-pixel monochrome grain.
- Grain: medium, amplitude 26 × (0.7 + 0.6 × luminance). No sparkle pass.
- Shapes: `converge`, `sunrise`, `diagonal`.
- Palettes (base top → bottom; rays; highlight):
  - violet: `#16005a → #3a0bb8`; `#7b2cff #a52cff #5a1aff #e040ff #4a10e0`; `#7fe9ff`
  - cobalt: `#020a3a → #0a2a9a`; `#1f4dff #2f7bff #0f2fd0 #4aa8ff #1838e8`; `#8ff5ff`
  - sunset: `#2a0a2e → #5a1440`; `#ff5a5f #ff8a4a #ffb547 #d93a7a #ff6f91`; `#ffe7a8`
  - ember: `#0d0605 → #2a0c06`; `#ff4a1c #ff7a1c #d92a10 #ffa53a #b0200c`; `#ffe0a0`
- Generated by a seeded script, committed as WebP like migrations. Regenerate on purpose when the look changes.

## App icon

- Backdrop violet, sunrise, seed 1, cropped to the square at 30 % of the vertical slack.
- The word `ardoise`, lowercase, white, Figtree 500, centred on its ink, 10 % margin; 22 % in the maskable variant so Android's circle mask never clips it.
- A dark radial halo behind the text (`.38` → `.12` at 55 % → transparent at 80 %) for legibility.
- Generated with the backdrops by `pnpm --filter @ardoise/frontend backdrops` into `public/icons/` (180 Apple touch icon, 192, 512, maskable 512, 48 favicon).

## Workflow

1. **Slices are whole features**: backend, frontend and tests in one run.
2. **Checkpoint 1, spec**: screens, states, flows, edge cases, tap count of the main action. Approved before building.
3. **UX forks get two versions** behind the dev-only A/B toggle. The owner tries both in a desktop browser's mobile view. Before merge, the losing variant and its toggle registration are deleted. The pick goes in the log below.
4. **Build without stopping**; interrupt only for an unclear domain rule or a convention that would need breaking. Every slice adds or extends Playwright scenarios (`apps/e2e/e2e/`) for its use cases.
5. **Checkpoint 2, PR**: `pnpm verify` green; screenshots of every screen in every state, light and dark, full set at 393×852, 360/375 only where they differ; forks side by side.

### How to add an A/B fork

1. In the feature component: `private readonly variants = inject(VariantService)`, register once with `this.variants.register('add-expense', 'Add expense form')`.
2. In the template: `@if (variants.variant('add-expense')() === 'b') { …B… } @else { …A… }`.
3. A floating A/B pill appears bottom-left in dev builds only (`VARIANTS_ENABLED` is `false` in `environment.prod.ts`, so production never loads it). The choice persists in `localStorage['ardoise.variant.<key>']`.
4. Before merge: delete the losing branch, the `register` call and the `VariantService` injection; log the pick below.

### Screenshots

With the frontend running (`pnpm dev:front`), `pnpm --filter @ardoise/e2e screenshots` writes `apps/e2e/screenshots-out/{route}-{state}-{theme}-{w}x{h}.png` for every screen and state in light and dark at 393×852; `ALL_SIZES=1` adds 360×780 and 375×667. API responses are faked by Playwright route interception (`apps/e2e/screenshots/fixtures.ts`), so loading, empty, error and filled states are all reachable without a backend. Add a cell to `apps/e2e/screenshots/matrix.ts` for every new screen state.

## A/B decisions log

| Date | Screen | Picked | Why |
|------|--------|--------|-----|
| 2026-10-25 | Visual direction | Ink + one abstract moment | Strong black/white, color only in precise places |
| 2026-10-25 | Moment surface | Grain + light rays, violet, medium grain | CSS gradients felt artificial; heavy grain feels like light |
| 2026-10-25 | Login, accept-invite | Full-screen backdrop | Over a top band |
| 2026-10-25 | Group rows on home | Backdrop fading in from the right (D) | The 28px tile felt compacted; full image cards/stripes too loud; edge band too quiet |
| 2026-10-25 | Typeface | Figtree | Over Geist, Inter Tight, Manrope, Instrument Sans, Onest, Hanken, Schibsted |
| 2026-10-26 | Add payment options | Native selects + inline split on one screen | Sub-screens felt heavy |
| 2026-10-26 | Payment detail actions | Text-only Edit/Delete | Icons made it heavier |
| 2026-10-26 | Money format on options screen | app-wide MoneyAmount (€24.50) | one format per screen |
| 2026-10-26 | App icon | Full word `ardoise` over violet sunrise, dark halo | Over a lone `a` and other palettes; halo over a uniform dim or a text shadow |
| 2026-10-26 | Group hero balance | Under the members, right-aligned (C5): "You owe" / "Owed to you" / "Settled up" | Z reading; the figure stays small |
| 2026-10-26 | Balances access on the group page | Payments / Balances tabs under the hero (C) | Most visible access |
| 2026-10-26 | Balances tab | Member ink bars, then repayments (T3) | Nicest to scan, outside the quick flow |
| 2026-10-27 | Admin entry | Round shield button at the top right of home, admins only | Out of the way for everyone else |
| 2026-10-27 | Admin overview | Title, instance host, three count tiles, Users / Groups tabs (`?tab=groups`), list rows | Overview first, actions later |
| 2026-10-27 | Admin details | Sections (Groups + Sessions for a user, Members + Invite links for a group), destructive-text Revoke behind a confirmation sheet | Sections leave room for later settings and actions |

# Payments: group page, add / edit / delete, feed

The rest of the Payments slice in `docs/roadmap.md`: payment list (backend), group page, add-payment form, payment feed. Two items are added: payment details, and editing and deleting a payment. Split computation and create-payment are already done.

## Why

Adding a payment is the moment the app exists for, and it usually happens on the spot: at the till, at the table. The owner's picture: "quickly open the app, already on my last group (it should be obvious which group I'm on), tap +, type the amount, then the title, then be presented the other options." Everything here serves that: the shortest possible path from opening the app to a saved payment, and no doubt about which group it lands in.

## Goals

- The app opens straight onto the last group used, and its identity (backdrop, name) dominates the top of the screen.
- Common case in 4 taps: **+ → Next → Next → Save** (amount and title typed in between).
- Everything beyond amount and title sits on one options screen, prefilled with defaults. No sub-screens.
- A group's payments are visible as a feed. Tapping one opens its details, with Edit and Delete.
- Back navigation (‹, browser back, iOS/Android swipe) always lands somewhere sensible.

## Non-goals

- Balances, "you owe / you're owed", any money-coloured information on rows (Balances slice).
- Real-time updates from other members (SSE slice). The feed refreshes on load.
- Feed pagination. All payments of the group load at once.
- Restricting who may edit or delete (later, as a group setting).
- A hand-written swipe-back gesture. The owner checked that native swipe-back works in an installed PWA (Actual Budget), so we rely on real browser history. Revisit only if it fails for Ardoise on a device.
- PWA manifest and standalone mode. The roadmap's PWA item stays separate; this slice only does the iOS keyboard handling the form needs.
- Remembering the last split mode. The owner decided: **always Equally, everyone ticked**.
- Categories, receipts, currency conversion, notes.

## Anti-goals

- Adding a payment to the wrong group because the context wasn't visible.
- A form that feels heavy: no extra screens for payer, date or split, no icon clutter.
- Amounts shown in the form that differ from what gets stored.

## Domain rules (decided)

- **Any member of the group may edit or delete any payment.** The owner decided this, and it goes into `docs/domain.md`. Moderator-only or author-only rules may come later as group configuration.
- Edit recomputes shares from `splitType` + `inputValue` against the new total. This is already in `docs/domain.md`.
- Delete is a hard delete. `payment_share` already cascades. A settlement never touches payments, so no history is needed for balances.
- The payer may be left out of the split (they paid for others).

## Screens

Real sizes below; the brainstorm mockups were drawn at about 56% scale. Every tap target is ≥ 44px. Canvas 393×852.

### Opening the app

- On launch, if this device remembers a last group (`localStorage`, key in the `ardoise.` namespace) and the user still belongs to it, the app goes **home → group**, pushing the group onto history. Back from the group therefore always lands on the group list.
- The redirect happens **once per app launch**. Coming back to home with ‹ or a swipe must not bounce to the group again.
- No remembered group, or the group is gone or not accessible: stay on home.
- Opening any group page updates the remembered group.
- The last group is remembered per device, not per account (my call: no backend change, and the device is where the habit lives).

### Group page (`/group/:id`)

- **Hero**: the group's backdrop (from `backdropFor(groupId)`, as on the home row), the group name large, and the member names below it ("You, Léa, Tom, Max, Inès"). With only the creator: "Just you so far". Top bar over the hero: **‹** to home, **⋯** menu.
- **⋯ menu**: "Invite people", **moderators only** (my call: `CreateInviteLinkUseCase` already restricts link creation to moderators, and `docs/domain.md` says only moderators configure the group; the item is hidden for other members, and the menu is hidden if it would be empty). It generates a fresh invite link and shows the same copy/share step as the create-group sheet's second step, reused rather than duplicated. This is the roadmap's "invite-link action for an existing group".
- **Feed**: payments newest first by `paidAt`, grouped under day headers (Today, Yesterday, then "Sat 24 Oct"). Each row: title, "Paid by Léa" ("Paid by you" for the current user), amount in the group currency. Hairline-separated rows, no cards. Tapping a row opens the details.
- **FAB +**: bottom-right, opens the add flow.
- **States**: loading (skeleton rows, never a spinner), empty ("No payments yet", plus a quieter line pointing to +, and to inviting from ⋯ for moderators), error (page-state with retry), group not found or not a member (error state with a way back home).
- Home group rows now navigate here.

### Add payment: amount (`/group/:id/payments/new`, step 1)

- Top bar: ‹/✕ (leaves the flow; nothing saved), and a small chip with the group's colour and name, so the target group is always visible.
- A large amount field, focused on arrival, numeric keypad up (`inputmode="decimal"`), label "Amount" underneath, group currency shown. Accepts a comma or dot, at most 2 decimals, > 0, ≤ the contract max.
- **Next** (above the keypad, also on the keyboard's enter) is disabled until the amount is valid.

### Add payment: title (step 2)

- The amount is shown small at the top, the group chip stays.
- The title field is focused on arrival. Its **placeholder** is the default title, "Payment, 26 Oct" (today's date in the user's locale), and its **label** is "Title" underneath, mirroring the amount screen. The owner asked for a placeholder instead of a hint.
- Optional. Left empty, the placeholder text is saved as the title. Max 255.
- **Next** goes to options.

### Add payment: options (step 3)

One screen, top to bottom:

1. Amount and title, small, as a recap. Tapping either one goes back to its step.
2. **Paid by** and **Date** side by side, both **native** controls: `<select>` of group members (default: me), `<input type="date">` (default: today). They open the phone's own picker. The owner chose native controls over sub-screens because new screens felt heavy.
3. **Split**: a 4-way segmented control, **Equally / Shares / % / Exact**. Always opens on Equally.
4. **Member list** (one 48px row per member, in a stable order with me first). The row's control follows the mode:
   - **Equally**: a checkbox; the whole row toggles it. Live amount on the right. Unticked rows dim and show "—". All ticked by default.
   - **Shares**: − / + stepper (44px buttons with a gap), min 0, default 1, euro amount next to the name.
   - **%**: number field (44px), up to 2 decimals, euro amount next to the name.
   - **Exact**: amount field (44px), per person.
5. A running total line for % and Exact ("18,50 of 24,50 €", "80 of 100 %"). It turns to an error colour when the total is over.
6. **Save**, primary, pinned to the bottom (thumb zone), 48px. Disabled while the split is invalid: no one ticked, all shares 0, % ≠ 100, exact ≠ total.

Switching mode keeps the amount and the other fields. Each mode starts from its own defaults (my call; carrying values across modes makes little sense).

With the keyboard open (% / Exact), the list scrolls, and the running total and Save stay visible above the keyboard (iOS keyboard handling: `visualViewport` / `interactive-widget`, the builder picks).

Live amounts must equal what the server stores, to the cent. See "Split logic shared" below.

### Save (create)

- Optimistic: return to the group page immediately, and the new payment is in the feed (marked pending, not tappable until confirmed). On failure the row disappears and a message says why (toast via helm `sonner` or similar, the builder picks among existing helm components).
- History: the three steps are replaced, so back/swipe from the group page after saving goes home, never into the finished form.

### Payment details (`/group/:id/payments/:paymentId`)

- ‹ back to the group.
- Amount large (light weight, tabular), title, then a meta line "Paid by Léa · Sun 25 Oct · Equally".
- "Shares" section: one row per member with their amount. Members not part of the payment show "—".
- Bottom: **Delete** (outline, destructive text) and **Edit** (primary), **text only**. The owner prefers text-only buttons: icons would make the UI heavier.
- States: loading skeleton, not found (deleted meanwhile), error with retry.

### Edit (`/group/:id/payments/:paymentId/edit`)

- The same form, prefilled from the payment and its shares (`inputValue` mapped back into the mode's controls: basis points → %, cents → amount).
- **Opens on the options step** (my call: the usual edit is the payer, the date, or the split). Tapping the amount or title recap goes to that step.
- Save is optimistic like create, then returns to the details screen. On failure, the previous values come back and a message is shown.

### Delete

- Tapping Delete opens a confirmation sheet: "Delete "Groceries"?", "Everyone's balances will be updated.", a destructive **Delete** button and **Cancel**.
- Confirm: optimistic, back to the group page with the row gone. On failure the row returns with a message.

### Back navigation

Every screen and every add/edit step is a real router navigation (history entry), so ‹, browser back and native swipe all behave the same:

- group → home
- amount → group (form discarded)
- title → amount (values kept), options → title (values kept)
- details → group, edit → details

Reloading mid-flow on step 2 or 3 with no form state in memory goes back to step 1.

## Split logic shared

The form must show exactly the cents the server will store, and the rounding rule (largest remainder, payer-favouring tie-break, then lowest member id) is non-trivial. **Move the pure split computation (`apportion.ts`, `compute-payment-shares.ts` and their specs) into `@ardoise/shared`**, and have both the backend domain and the frontend import it. The owner approved this.

Why it can live there without breaking the hexagon: these are pure functions with no Nest, Drizzle or Angular dependency, which is exactly what `domain/` code is. The shared lib becomes a "shared kernel": domain code that two contexts (here two apps) agree on. The backend domain still owns the rule of *when* shares are computed (create, edit), and the frontend only previews them; the server stays the authority. The alternative, a frontend copy, would drift.

## Member names

Names appear everywhere (hero, "Paid by", selects, split rows, details), but `groupMemberSchema` only returns `nickname` (never set by any flow) and no user name. My call: the member list-by-group response gains a `name` field, computed as `nickname ?? user.name`. The member Drizzle repository joins `users` to read it. That join is a persistence detail, so it stays in infrastructure, and the domain `Member` gains a `name`. The current user is shown as "You" by the frontend, matching `userId` against the session user.

## Payment date

The form picks a date, but `paidAt` is a full datetime. My call: today → the current instant; another date → that date at 12:00 local time (noon keeps it on the same calendar day across nearby timezones). On edit, an unchanged date keeps the stored `paidAt`. The feed groups by the `paidAt` calendar day in the viewer's local time.

## Backend

Placement, and why:

- **`ListGroupPaymentsUseCase`** (`payment/application`): read-only, so it injects `PAYMENT_REPOSITORY` and the member repository directly (no unit of work). It checks that the caller is a member of the group (`NotAMember`), then returns the payments. The membership check is a single guard condition, so it stays in the use case and no domain service is created.
- **`updatePayment`** (`payment/domain/update-payment.ts`, next to `create-payment.ts`) with **`UpdatePaymentUseCase`** running it in `uow.run`: it is a multi-write (update payment, replace its shares), so it needs a transaction. The domain function holds the rules: the caller is a member of the payment's group, the payer and participants belong to the group, and shares are recomputed. Same shape as `createPayment`, sharing its validation helper if the duplication is real.
- **`DeletePaymentUseCase`**: membership check, then delete. One write, and shares cascade in the database, so no unit of work. It injects the repositories directly.
- **Repository**: `PaymentRepository` gains `findByGroupId`, `update`, `delete`. `PaymentShareRepository` gains `replaceForPayment` (or delete + `createMany`).
- **Contracts** (`@ardoise/shared`, `paymentApi`):
  - `listByGroup`: `GET /groups/:groupId/payments` → `PaymentResponse[]`, sorted by `paidAt` desc, then `id` desc. Shares are not included (the feed doesn't need them; details already uses `paymentShareApi.findByPayment`).
  - `update`: `PUT /payments/:id`, body = create body without `groupId`, → `CreatePaymentResponse` shape.
  - `delete`: `DELETE /payments/:id` → 204.
  - Error enums extended as needed. Non-member → 403, unknown payment → 404 (as the existing read endpoints map them).
- `docs/domain.md`: add "Any member can edit or delete a payment".

## Frontend placement

- New feature folder `src/app/payment/` (add/edit flow, details) and `src/app/expense-group/group-page/`. A `PaymentApiService` next to the existing API services.
- Flow state shared across the three steps lives in a service provided on the flow's parent route, so it survives step navigation and dies when the flow ends.
- Building blocks: reuse `mobile-shell`, `hero-screen`, `backdrop`, `list-row`, `money-amount`, `page-state`, `text`. Probably new blocks in `shared/ui`, called out in the PR: the **group chip** (colour + name), and possibly a **segmented control** if helm `toggle-group` doesn't fit. The amount input may be a new block too.
- `docs/design.md`: log the decisions (native selects, one options screen, text-only buttons), and replace the add-expense reference flow with this one.

## Testing

- Backend e2e (`test/`, testcontainers): list (member, non-member, ordering), update (recomputes shares, member rules, validation errors), delete (member, non-member, cascade). The shared split specs move with the code.
- Frontend unit specs next to the components: step navigation and the form state service, live split preview per mode, Save disabled rules, last-group redirect firing once.
- Playwright scenarios (`apps/e2e/e2e/`), named as use cases: *add a payment with the defaults*, *add a payment split by shares / excluding a member*, *edit a payment*, *delete a payment*, *app opens on the last group*, *back from a group returns to the list*.
- Screenshot matrix cells: group page (loading, empty, filled, error), add steps (amount, title, options × 4 modes, exact invalid), details, delete confirm, edit. Light and dark.

## Left to the builder

- Exact route nesting and the form state service's shape.
- Toast component choice, keyboard-handling technique, skeleton details.
- Date header formatting and locale details, as long as they're consistent with existing screens.
- Whether `PUT` reuses the create schema via `.omit`.

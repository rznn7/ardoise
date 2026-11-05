# 10 Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each feature speaks with its own copy plus `common.*` and `ui.*`, the round back/close button is one building block, and "amount or dash" is written once.

**Architecture:** Borrowed keys couple features through wording: rewording the sign-out sheet's "Cancel" today changes the payment form. Shared wording moves to `common.*`, and a small script in `lint` (same shape as `scripts/check-component-css.ts`) rejects a key from another feature's namespace. Its allow-list is data in the script, so each exception is a visible decision. The back button and the dash for missing amounts are presentation details repeated across screens, so they become `shared/ui` building blocks (design.md, "Building blocks").

Runs after plan 09, because `FeedList` is one of the script's allowed exceptions.

**Tech Stack:** Transloco (unflat JSON in `src/i18n/en.json`, `fr.json`), `transloco-keys-manager`, tsx, Angular 22.

**Spec:** `README.md` finding 10

## Global Constraints

- English and French values below are exact. Keys removed from a namespace are deleted from both files (`i18n:check` fails on extra keys).
- A new building block is listed in `docs/design.md` under "Building blocks" and called out in the PR.

| Borrowed key | Used in | Becomes | en | fr |
|---|---|---|---|---|
| `settings.back` | every back button | `common.back` | Back | Retour |
| `settings.signOut.cancel` (outside settings) | confirm sheets, amount step close | `common.cancel` | Cancel | Annuler |
| `invite.panel.done` | amount and title steps | `common.done` | Done | Terminé |
| `settings.yourName` | accept invite | `common.yourName` | Your name | Votre nom |
| `settlement.confirmUndo.description` | payment delete sheet | `common.balancesWillUpdate` | Everyone's balances will be updated. | Les soldes de tout le monde seront mis à jour. |
| `group.loadFailed` | admin group | `admin.group.loadFailed` | Couldn't load this group | Impossible de charger ce groupe |
| `payment.meta.someone` | admin group | `admin.group.someone` | someone | quelqu’un |
| `group.tabs.payments`, `group.view` | admin overview | `admin.payments`, `admin.view` | Payments, View | Paiements, Affichage |
| `group.tabs.balances` | group balances | `balance.title` | Balances | Soldes |
| `balance.undo` | settlement details | `settlement.undo` | Undo repayment | Annuler le remboursement |
| `group.feed.repayment` | settlement details, feed list | `settlement.repayment` | Repayment | Remboursement |
| `settings.version.*` | `shared/version` | `ui.version.*` | (same values) | (same values) |

The settings screen keeps its own `settings.signOut.cancel` and `settings.yourName`, or switches to the `common.*` keys if those were their only other users; then delete them.

Allowed cross-namespace uses, kept in the script: `home` → `group` (the create-group button), `feed` → `payment`, `settlement` (the feed is made of both).

## Review Focus

1. French screens after the move: every moved key keeps its French value (lowercase "quelqu’un" mid-sentence in "Utilisé par …"). Pinned by the table; run the screenshot matrix in French for the touched screens.
2. Screen readers: the back button's accessible name is unchanged ("Back", or the explicit label such as "Back to groups"). Pinned in Task 2.
3. A dynamic key (`t(mode.labelKey)`) is not checked by the script; that is accepted, the keys come from `marker()` calls that are checked.

---

### Task 1: Scoped i18n keys

**Files:**
- Create: `apps/frontend/scripts/check-i18n-scope.ts`
- Modify: `apps/frontend/package.json` (`lint` runs the script after `check-component-css.ts`)
- Modify: `apps/frontend/src/i18n/en.json`, `fr.json`, and every template or `.ts` using a row of the table
- Modify: `apps/frontend/CLAUDE.md`

**Interfaces:**
- Produces: script exiting 1 with `path:line: '<key>' belongs to <namespace>` lines. Context = first folder under `src/app`. Own namespace map: `admin→admin`, `auth→auth`, `balance→balance`, `expense-group→group`, `feed→feed`, `home→home`, `invite-link→invite`, `payment→payment`, `settings→settings`, `settlement→settlement`, `shared→ui`. Always allowed: `common`, `ui`. Pattern: `/\b(?:t|marker|translate)\(\s*'([a-zA-Z]+)\./g` over non-spec `.ts` and `.html`.

- [ ] **Step 1: Write the script and run it on `main`**

Run: `pnpm --filter @ardoise/frontend exec tsx scripts/check-i18n-scope.ts`
Expected: exit 1, listing exactly the uses in the table (plus `group-page` → `payment.meta.*` if plan 09 has not moved them into `FeedList`).

- [ ] **Step 2: Apply the table** (new keys in both JSON files, call sites, deletions)
- [ ] **Step 3: Run the script and `i18n:check`; both pass**

Run: `pnpm --filter @ardoise/frontend lint`

- [ ] **Step 4: Append to `apps/frontend/CLAUDE.md` under `## Copy and navigation`**, replacing the plan 00 line about i18n:

```markdown
- A feature uses its own i18n namespace plus `common.*` and `ui.*` (`scripts/check-i18n-scope.ts` enforces it). Wording two features share moves to `common.*`.
```

- [ ] **Step 5: Verify (frontend tests + Playwright, which assert the text users read) and commit**

Run: `pnpm --filter @ardoise/frontend test && pnpm --filter @ardoise/e2e test:e2e`

```bash
git commit -m "Features use their own i18n keys; shared wording in common"
```

### Task 2: `app-back-button`

**Files:**
- Create: `apps/frontend/src/app/shared/ui/back-button/back-button.ts`, `back-button.spec.ts`
- Modify: the templates of `settings`, `admin-overview`, `admin-user`, `admin-group`, `payment-details`, `settlement-details`, `amount-step`, `title-step`, `options-step`, `group-page` where they render the round chevron or X button
- Modify: `docs/design.md` ("Building blocks")

**Interfaces:**
- Produces: `<app-back-button>` rendering a `type="button"` round 44 px icon button. Inputs: `kind: 'back' | 'close'` (default `'back'`, icon chevron-left or X), `tone: 'plain' | 'inverted'` (ghost or inverted-outline), `label: string | undefined` (accessible name; default `common.back` / `common.cancel`). Consumers bind `(click)` on the element.

- [ ] **Step 1: Spec**: default accessible name "Back"; `kind="close"` → "Cancel"; `label="Back to groups"` wins; clicking emits the host click once; the button carries `size-11` and `rounded-full` (a building block may assert the classes it promises).
- [ ] **Step 2: Run, see it fail, implement, see it pass**

Run: `pnpm --filter @ardoise/frontend test -- back-button`

- [ ] **Step 3: Replace the copies**

Run afterwards: `grep -rn "size-11 shrink-0 rounded-full\|size-11 rounded-full" apps/frontend/src/app --include=*.html`
Expected: three left, which are not back buttons: the settings and admin links on `home` and the group page's menu trigger (it carries `hlmSheetTrigger`).

- [ ] **Step 4: Add the block to `docs/design.md`, verify, commit**

Run: `pnpm --filter @ardoise/frontend lint && pnpm --filter @ardoise/frontend test`

```bash
git commit -m "Back button building block"
```

### Task 3: Missing amounts render a dash

**Files:**
- Modify: `apps/frontend/src/app/shared/ui/money-amount/money-amount.ts` and its spec
- Modify: `apps/frontend/src/app/payment/payment-form/options-step.ts`, `options-step.html`

**Interfaces:**
- Produces: `MoneyAmount.cents: number | null`; `null` renders `—`.

- [ ] **Step 1: Spec** `renders a dash for a missing amount`. Run, see it fail, implement.
- [ ] **Step 2: Options step**: `shareOrNull(memberId): number | null` (null when the preview has no positive share); the three `@if … else —` blocks become one `<app-money-amount [cents]="shareOrNull(row.id)" …>` each, inside one outer `@if (draft.group(); as group)`.
- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @ardoise/frontend test -- money-amount options-step && pnpm --filter @ardoise/frontend typecheck`

```bash
git commit -m "Money amount renders a dash when there is none"
```

Then `pnpm --filter @ardoise/e2e screenshots` for the options, details, settings and admin screens in light and dark, attached to the PR.

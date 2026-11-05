# 00 Guardrails Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the frontend conventions where Claude Code reads them only when it touches the frontend, and add a review step before every PR.

**Architecture:** A nested `apps/frontend/CLAUDE.md` holds one-line rules. Later plans append the rule for the helper they introduce, in the same commit as the helper, so the file never names something that does not exist yet. The root `CLAUDE.md` gains two lines: a pointer and `/simplify` before the PR.

**Tech Stack:** Markdown.

**Spec:** `README.md` (Guardrails section)

## Global Constraints

- `apps/frontend/CLAUDE.md` stays under 40 lines for the whole series. A rule that needs a paragraph belongs in a plan.
- A rule enforced by lint does not repeat in `CLAUDE.md` unless it carries a judgement the selector cannot (when an exception is fine).

## Review Focus

1. A rule naming a helper that does not exist yet: Claude would invent it. Only rules true on `main` go in this plan.

---

### Task 1: Frontend conventions file and root pointers

**Files:**
- Create: `apps/frontend/CLAUDE.md`
- Modify: `CLAUDE.md` (sections `## UI` and `## Workflow`)

- [ ] **Step 1: Create `apps/frontend/CLAUDE.md` with exactly this content**

```markdown
# Frontend conventions

Rules the code once drifted from. The story is in `docs/superpowers/plans/2026-11-05-frontend-quality/`.

## Signals and effects

- `effect` is a last resort: only to push state into something outside Angular (DOM API, storage, an observer). Never to load data, copy one signal into another, or react to a state transition. Load with `rxResource`, derive with `computed` or `linkedSignal`, react to events (route params, realtime, user actions) where they happen.
- Every `subscribe` handles `error`. When ignoring is right, write `error: () => undefined` so the choice is visible.
- A subscription a component starts and that can outlive it (anything that navigates or toasts) pipes `takeUntilDestroyed(this.destroyRef)`.

## State

- Stores expose plain reads (`feedOf(groupId)`) and intent methods. A method with parameters never returns a `Signal`; a store never exposes a `WritableSignal`.
- Coordination between stores lives in the stores, not in a component that happens to show both.

## Reuse

- Before writing a helper, search `src/app/shared` and the context folder. Extract at the second copy.

## Copy and navigation

- A feature uses its own i18n keys plus `common.*` and `ui.*`. Wording two features share moves to `common.*`.
- Never move through history by a fixed count.
- Components are OnPush by default in Angular 22: do not set `changeDetection`.
```

- [ ] **Step 2: Add the pointer and the review step to the root `CLAUDE.md`**

At the end of `## UI`, add: `- Frontend code conventions: apps/frontend/CLAUDE.md.`
In `## Workflow`, step 5, after "`pnpm verify` green,", insert: "`/simplify` run on the branch and its fixes committed,".

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/CLAUDE.md CLAUDE.md
git commit -m "Frontend conventions file and /simplify before PR"
```

# Amount entry: cash-register digits

## Why

On an iPhone, typing a payment's total today means reaching for the decimal separator on every
amount (`2`, `4`, `,`, `5`, `0`). The owner wants the Tricount feel: only digits, filled from the
right, so the thumb never leaves the digit pad.

## Goal

The **total amount** field of the payment form (amount step, `payment/payment-form/amount-step`)
fills like a cash register:

| Keys | Field shows (fr) | Cents |
|------|------------------|-------|
| (nothing) | `0,00` placeholder | none |
| `1` | `0,01` | 1 |
| `1` `2` | `0,12` | 12 |
| `1` `2` `3` | `1,23` | 123 |
| `1` `2` `3` `0` | `12,30` | 1230 |
| backspace | `1,23` | 123 |

- Each digit is appended on the right; the amount shifts left. No separator is ever typed.
- Backspace drops the rightmost digit. Removing the last digit empties the field (placeholder shows
  again).
- The separator follows the active language (`,` in French, `.` in English), as
  `formatAmountInput` already does. No thousands grouping, as today.
- The keyboard is `inputmode="numeric"`: on iOS, the digit-only pad, no separator key.
  `enterkeyhint="next"` stays.
- "Next" (or "Done" when editing) stays disabled while the amount is empty or zero, as today.
- Editing a payment opens the field on the existing amount (`12,50`); backspace and digits continue
  from the right (`12,50` + `3` → `125,03`).

## Decided

- **Only the total.** Per-person exact amounts and percentages keep today's free entry with
  `inputmode="decimal"`.
- **No A/B fork.** The owner picked cash-register entry outright; free entry of the total is
  replaced, not kept behind the toggle. Log the pick in `docs/design.md`'s A/B decisions log.
- **Out of scope**, stays in `docs/roadmap.md`: arithmetic in the field (`12,50+8`), a validate
  key on the keyboard, an in-app keypad. The roadmap's Amount entry slice is split accordingly:
  cash-register entry checked off, inline math and the validate key left open.

## Builder's calls (Claude's, the owner did not weigh in)

- **Leading zeros** are ignored: `0` on an empty field leaves it empty.
- **Upper bound**: a digit that would exceed `MAX_CENTS` (2 147 483 647) is ignored.
- **Caret** always sits at the end; tapping into the middle or selecting does not allow editing
  there. Any edit operates on the digit string.
- **Paste, autofill and Playwright `fill`**: the field keeps the digits of whatever text arrives
  and reads them as cents, so `24,50`, `24.50` and `2450` all give 24,50. Only for pasted text
  with fewer than two fraction digits (`24,5`, `24`) does this differ from today: they become
  2,45 and 0,24. Accepted: pasting is rare on this field, and the field shows the result.
- **Where the logic lives**: the digit rules (append, drop, digits ↔ cents, bound) are pure
  functions next to `money-input.ts` with unit specs for their edge cases. The draft keeps storing
  the amount as text (`amountText`) so `parseAmount` and the edit prefill are unchanged; the
  amount step formats the cents back into that text. How the input intercepts keystrokes
  (`beforeinput`, `input`, or both) is the builder's choice, as long as it works with the iOS
  digit pad, a hardware keyboard and Playwright.
- Whether this becomes a reusable `shared/ui` building block or stays in the amount step: stays in
  the amount step unless a second caller appears.

## Tests

- Unit specs for the pure digit rules (append, backspace, leading zero, bound, digits from pasted
  text).
- `amount-step.spec.ts`: field is `numeric`; typing `1`, `2`, `3` shows `1.23` (the spec runs in English) and enables
  Next;
  backspace to empty disables it; edit mode opens on the existing amount and continues from the
  right.
- Playwright: no new scenario, the behavior is a single field covered by the component spec. The
  existing callers must change: `fixtures/group.ts` `addPayment`/`startPayment` are called with
  `'30'`, `'12'`, `'18'` across about ten scenarios, which the paste rule reads as 0,30, 0,12,
  0,18. Pass two-decimal strings (`'30,00'`) or type digits. `fill('24,50')` in
  `add-payment.spec.ts` and the screenshot matrix still means 24,50.
- Screenshots: the amount step empty and typed, light and dark, as today.

## Done when

`pnpm verify` green, screenshots of the amount step, roadmap and A/B log updated.

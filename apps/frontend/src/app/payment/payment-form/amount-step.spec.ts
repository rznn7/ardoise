import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type ExpenseGroupSummary, type GroupMember } from '@ardoise/shared';
import { screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';

import { AmountStep } from './amount-step';

@Component({ template: '' })
class Blank {}

const GROUP: ExpenseGroupSummary = {
  id: 7,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
];

async function setup(): Promise<{ draft: PaymentDraft; router: Router }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'group/:groupId', component: Blank },
          { path: 'group/:groupId/payments/new/amount', component: AmountStep },
          { path: 'group/:groupId/payments/new/title', component: Blank },
        ],
        withHistoryPageIds(),
      ),
    ],
  });
  const draft = TestBed.inject(PaymentDraft);
  draft.startNew(7, MEMBERS, 11);
  draft.group.set(GROUP);
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, '/group/7');
  await harness.navigateByUrl('/group/7/payments/new/amount');
  harness.detectChanges();
  return { draft, router: TestBed.inject(Router) };
}

const amountInput = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>('Amount');
const nextButton = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Next' });

describe('AmountStep', () => {
  it('focuses a numeric amount field labelled Amount on arrival', async () => {
    await setup();

    expect(amountInput().getAttribute('inputmode')).toBe('numeric');
    await waitFor(() => {
      expect(document.activeElement).toBe(amountInput());
    });
  });

  it('shows the group chip', async () => {
    await setup();

    expect(screen.getByText('Lisbon trip')).toBeTruthy();
  });

  it.each(['', '0', 'abc'])('keeps Next disabled for %j', async (text) => {
    await setup();

    if (text !== '') await userEvent.type(amountInput(), text);

    expect(amountInput().value).toBe('');
    expect(nextButton().disabled).toBe(true);
  });

  it('fills digits from the right', async () => {
    const { draft } = await setup();

    await userEvent.type(amountInput(), '123');

    expect(amountInput().value).toBe('1.23');
    expect(draft.amountCents()).toBe(123);
    expect(nextButton().disabled).toBe(false);
    expect(amountInput().selectionStart).toBe(4);
  });

  it('empties on backspace and disables Next', async () => {
    await setup();

    await userEvent.type(amountInput(), '12{Backspace}{Backspace}');

    expect(amountInput().value).toBe('');
    expect(nextButton().disabled).toBe(true);
  });

  it('appends a digit wherever the caret sits', async () => {
    await setup();
    await userEvent.type(amountInput(), '123');

    await userEvent.type(amountInput(), '5', {
      skipClick: true,
      initialSelectionStart: 1,
      initialSelectionEnd: 1,
    });

    expect(amountInput().value).toBe('12.35');
  });

  it('drops the last digit wherever the caret sits', async () => {
    await setup();
    await userEvent.type(amountInput(), '123');

    await userEvent.type(amountInput(), '{Backspace}', {
      skipClick: true,
      initialSelectionStart: 3,
      initialSelectionEnd: 3,
    });

    expect(amountInput().value).toBe('0.12');
  });

  it('replaces the whole amount when it is all selected', async () => {
    await setup();
    await userEvent.type(amountInput(), '123');

    await userEvent.type(amountInput(), '5', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: 4,
    });

    expect(amountInput().value).toBe('0.05');
  });

  it('empties when the whole amount is selected and erased', async () => {
    await setup();
    await userEvent.type(amountInput(), '123');

    await userEvent.type(amountInput(), '{Backspace}', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: 4,
    });

    expect(amountInput().value).toBe('');
  });

  it('continues from the right in edit mode', async () => {
    const { draft } = await setup();
    draft.mode.set('edit');
    draft.amountText.set('12.50');
    TestBed.tick();

    await userEvent.type(amountInput(), '3');

    expect(amountInput().value).toBe('125.03');
    expect(draft.amountCents()).toBe(12503);
  });

  it('goes to the title step on Next', async () => {
    const { router } = await setup();
    await userEvent.type(amountInput(), '2450');

    await userEvent.click(nextButton());

    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/new/title');
    });
  });

  it('goes to the title step on Enter', async () => {
    const { router } = await setup();

    await userEvent.type(amountInput(), '2450{Enter}');

    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/new/title');
    });
  });

  it('clears the draft and goes back on Cancel', async () => {
    const { draft } = await setup();
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(draft.active()).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('reads Done in edit mode and goes back to the options step', async () => {
    const { draft } = await setup();
    draft.mode.set('edit');
    TestBed.tick();
    const back = vi.spyOn(TestBed.inject(Location), 'back');
    await userEvent.type(amountInput(), '12');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(draft.active()).toBe(true);
  });
});

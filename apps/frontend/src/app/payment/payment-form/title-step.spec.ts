import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type ExpenseGroupSummary, type GroupMember } from '@ardoise/shared';
import { screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NOW, PaymentDraft } from 'src/app/payment/payment-draft';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';

import { TitleStep } from './title-step';

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
];

async function setup(): Promise<{ draft: PaymentDraft; router: Router }> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'group/:groupId/payments/new/amount', component: Blank },
          { path: 'group/:groupId/payments/new/title', component: TitleStep },
          { path: 'group/:groupId/payments/new/options', component: Blank },
        ],
        withHistoryPageIds(),
      ),
      { provide: NOW, useValue: () => new Date(2026, 9, 26, 15, 30) },
    ],
  });
  const draft = TestBed.inject(PaymentDraft);
  draft.startNew(7, MEMBERS, 11);
  draft.group.set(GROUP);
  draft.amountText.set('24,5');
  const harness = await RouterTestingHarness.create();
  await openFirstPage(harness, '/group/7/payments/new/amount');
  await harness.navigateByUrl('/group/7/payments/new/title');
  harness.detectChanges();
  return { draft, router: TestBed.inject(Router) };
}

const titleInput = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>('Title');

describe('TitleStep', () => {
  it("uses today's default title as the placeholder of a field labelled Title", async () => {
    await setup();

    expect(titleInput().getAttribute('placeholder')).toBe('Payment, 26 Oct');
    await waitFor(() => {
      expect(document.activeElement).toBe(titleInput());
    });
  });

  it('shows the amount and the group chip', async () => {
    await setup();

    expect(screen.getByText('€24.50')).toBeTruthy();
    expect(screen.getByText('Lisbon trip')).toBeTruthy();
  });

  it('keeps the typed title in the draft and goes to options on Next', async () => {
    const { draft, router } = await setup();

    await userEvent.type(titleInput(), 'Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(draft.title()).toBe('Groceries');
    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/new/options');
    });
  });

  it('goes back to the amount step with the values kept', async () => {
    const { draft } = await setup();
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(back).toHaveBeenCalledTimes(1);
    expect(draft.amountText()).toBe('24,5');
  });

  it('reads Done in edit mode and goes back', async () => {
    const { draft } = await setup();
    draft.mode.set('edit');
    TestBed.tick();
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

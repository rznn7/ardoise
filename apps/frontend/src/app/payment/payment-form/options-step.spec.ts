import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type ExpenseGroupSummary,
  type GroupMember,
  type PaymentResponse,
  type PaymentShareResponse,
} from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NOW, PaymentDraft } from 'src/app/payment/payment-draft';
import { PaymentStore } from 'src/app/payment/payment-store';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';

import { OptionsStep } from './options-step';

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
  { id: 13, userId: 3, name: 'Marc', nickname: null, isModerator: false },
  { id: 14, userId: 4, name: 'Nora', nickname: null, isModerator: false },
  { id: 15, userId: 5, name: 'Sam', nickname: null, isModerator: false },
];

const PAYMENT: PaymentResponse = {
  id: 5,
  groupId: 7,
  payerMemberId: 11,
  title: 'Dinner',
  paidAt: '2026-10-25T19:00:00.000Z',
  fullAmount: 2450,
  splitType: 'equal',
  createdAt: '2026-10-25T19:00:00.000Z',
};

const SHARES: PaymentShareResponse[] = MEMBERS.map((m) => ({
  paymentId: 5,
  memberId: m.id,
  inputValue: 0,
  amount: 490,
}));

interface Setup {
  draft: PaymentDraft;
  store: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  location: Location;
  router: Router;
}

async function setup(mode: 'new' | 'edit' = 'new'): Promise<Setup> {
  const store = { create: vi.fn(), update: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'group/:groupId', component: Blank },
          { path: 'group/:groupId/payments/new/amount', component: Blank },
          { path: 'group/:groupId/payments/new/title', component: Blank },
          { path: 'group/:groupId/payments/new/options', component: OptionsStep },
          { path: 'group/:groupId/payments/:paymentId', component: Blank },
          { path: 'group/:groupId/payments/:paymentId/edit/amount', component: Blank },
          { path: 'group/:groupId/payments/:paymentId/edit/title', component: Blank },
          { path: 'group/:groupId/payments/:paymentId/edit/options', component: OptionsStep },
        ],
        withHistoryPageIds(),
      ),
      { provide: NOW, useValue: () => new Date(2026, 9, 26, 15, 30) },
      { provide: PaymentStore, useValue: store },
    ],
  });
  const draft = TestBed.inject(PaymentDraft);
  const harness = await RouterTestingHarness.create();
  if (mode === 'new') {
    draft.startNew(7, MEMBERS, 12);
    draft.group.set(GROUP);
    draft.amountText.set('24,5');
    await openFirstPage(harness, '/group/7');
    await harness.navigateByUrl('/group/7/payments/new/amount');
    await harness.navigateByUrl('/group/7/payments/new/title');
    await harness.navigateByUrl('/group/7/payments/new/options');
  } else {
    draft.startEdit(PAYMENT, SHARES, MEMBERS);
    draft.myMemberId.set(12);
    draft.group.set(GROUP);
    await openFirstPage(harness, '/group/7/payments/5');
    await harness.navigateByUrl('/group/7/payments/5/edit/options');
  }
  harness.detectChanges();
  return {
    draft,
    store,
    location: TestBed.inject(Location),
    router: TestBed.inject(Router),
  };
}

const memberRows = (): HTMLElement[] => screen.getAllByRole('listitem');
const rowOf = (name: string): HTMLElement => {
  const row = memberRows().find((r) => within(r).queryByText(name) !== null);
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};
const segment = (name: string): HTMLElement => screen.getByRole('button', { name });
const runningTotal = (): HTMLElement => screen.getByRole('status');
const totalText = (): string => runningTotal().textContent.replace(/\s+/g, ' ').trim();
const save = (): HTMLButtonElement =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });

describe('OptionsStep', () => {
  describe('recap', () => {
    it('shows the amount and the default title', async () => {
      await setup();

      expect(screen.getByRole('button', { name: '€24.50' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Payment, 26 Oct' })).toBeTruthy();
    });

    it('shows the typed title', async () => {
      const { draft } = await setup();
      draft.title.set('Groceries');
      TestBed.tick();

      expect(screen.getByRole('button', { name: 'Groceries' })).toBeTruthy();
    });

    it('goes back one step to the title and two to the amount in new mode', async () => {
      await setup();
      const location = TestBed.inject(Location);
      const back = vi.spyOn(location, 'back').mockImplementation(() => undefined);
      const historyGo = vi.spyOn(location, 'historyGo').mockImplementation(() => undefined);

      await userEvent.click(screen.getByRole('button', { name: 'Payment, 26 Oct' }));
      expect(back).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', { name: '€24.50' }));
      expect(historyGo).toHaveBeenCalledWith(-2);
    });

    it('opens the amount and title steps in edit mode', async () => {
      const { router } = await setup('edit');

      await userEvent.click(screen.getByRole('button', { name: 'Dinner' }));
      await waitFor(() => {
        expect(router.url).toBe('/group/7/payments/5/edit/title');
      });
    });

    it('opens the amount step in edit mode', async () => {
      const { router } = await setup('edit');

      await userEvent.click(screen.getByRole('button', { name: '€24.50' }));
      await waitFor(() => {
        expect(router.url).toBe('/group/7/payments/5/edit/amount');
      });
    });
  });

  it('picks the payer natively, listing You first with me selected', async () => {
    const { draft } = await setup();
    const select = screen.getByLabelText<HTMLSelectElement>('Paid by');

    expect(select.tagName).toBe('SELECT');
    expect(Array.from(select.options).map((o) => o.text.trim())).toEqual([
      'You',
      'Gabriel',
      'Marc',
      'Nora',
      'Sam',
    ]);
    expect(select.value).toBe('12');

    await userEvent.selectOptions(select, 'Marc');
    expect(draft.payerMemberId()).toBe(13);
  });

  it('selects the stored payer in edit mode', async () => {
    await setup('edit');

    expect(screen.getByLabelText<HTMLSelectElement>('Paid by').value).toBe('11');
  });

  it('picks the date natively, today by default', async () => {
    const { draft } = await setup();
    const date = screen.getByLabelText<HTMLInputElement>('Date');

    expect(date.type).toBe('date');
    expect(date.value).toBe('2026-10-26');

    date.value = '2026-10-20';
    date.dispatchEvent(new Event('input'));
    expect(draft.date()).toBe('2026-10-20');
  });

  it('opens the split on Equally', async () => {
    await setup();

    expect(segment('Equally').getAttribute('aria-pressed')).toBe('true');
    expect(segment('Shares').getAttribute('aria-pressed')).toBe('false');
    expect(segment('%').getAttribute('aria-pressed')).toBe('false');
    expect(segment('Exact').getAttribute('aria-pressed')).toBe('false');
  });

  describe('Equally', () => {
    it('ticks everyone, You first, with live amounts', async () => {
      await setup();

      expect(memberRows().map((r) => /^\p{L}+/u.exec(r.textContent.trim())?.[0])).toEqual([
        'You',
        'Gabriel',
        'Marc',
        'Nora',
        'Sam',
      ]);
      expect(screen.getAllByRole<HTMLInputElement>('checkbox').every((c) => c.checked)).toBe(true);
      expect(within(rowOf('Gabriel')).getByText('€4.90')).toBeTruthy();
    });

    it('toggles a member by tapping the row and shows — when unticked', async () => {
      const { draft } = await setup();

      await userEvent.click(within(rowOf('Nora')).getByText('Nora'));

      expect(within(rowOf('Nora')).getByRole<HTMLInputElement>('checkbox').checked).toBe(false);
      expect(within(rowOf('Nora')).getByText('—')).toBeTruthy();
      expect(draft.included().has(14)).toBe(false);
      expect(within(rowOf('Gabriel')).getByText('€6.13')).toBeTruthy();
    });
  });

  describe('Shares', () => {
    it('splits 2/1/1/0/1 with steppers', async () => {
      await setup();
      await userEvent.click(segment('Shares'));

      await userEvent.click(screen.getByRole('button', { name: 'More shares for You' }));
      await userEvent.click(screen.getByRole('button', { name: 'Fewer shares for Nora' }));

      expect(within(rowOf('You')).getByText('€9.80')).toBeTruthy();
      expect(within(rowOf('Gabriel')).getByText('€4.90')).toBeTruthy();
      expect(within(rowOf('Marc')).getByText('€4.90')).toBeTruthy();
      expect(within(rowOf('Nora')).getByText('—')).toBeTruthy();
      expect(within(rowOf('Sam')).getByText('€4.90')).toBeTruthy();
    });

    it('ignores a tap on the already selected mode', async () => {
      const { draft } = await setup();
      await userEvent.click(segment('Shares'));
      await userEvent.click(screen.getByRole('button', { name: 'More shares for You' }));

      await userEvent.click(segment('Shares'));

      expect(draft.weights().get(12)).toBe(2);
      expect(segment('Shares').getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('%', () => {
    it('takes a percent per member and shows the running total', async () => {
      const { draft } = await setup();
      await userEvent.click(segment('%'));

      await userEvent.type(screen.getByLabelText('You percent'), '50');
      await userEvent.type(screen.getByLabelText('Gabriel percent'), '30');

      expect(draft.percentTexts().get(12)).toBe('50');
      expect(totalText()).toBe('80 of 100 %');
      expect(save().disabled).toBe(true);
    });
  });

  describe('Exact', () => {
    it('takes an amount per member and shows the running total', async () => {
      await setup();
      await userEvent.click(segment('Exact'));

      await userEvent.type(screen.getByLabelText('You amount'), '10');
      await userEvent.type(screen.getByLabelText('Gabriel amount'), '8,5');

      expect(totalText()).toBe('€18.50 of €24.50');
      expect(runningTotal().querySelector('.text-destructive')).toBeNull();
    });

    it('shows an over total as an error', async () => {
      await setup();
      await userEvent.click(segment('Exact'));

      await userEvent.type(screen.getByLabelText('You amount'), '30');

      expect(totalText()).toBe('€30.00 of €24.50');
      expect(runningTotal().querySelector('.text-destructive')).not.toBeNull();
      expect(runningTotal().classList.contains('text-xs')).toBe(true);
    });
  });

  describe('Save', () => {
    it('is disabled while the split is invalid', async () => {
      await setup();
      expect(save().disabled).toBe(false);

      for (const name of ['You', 'Gabriel', 'Marc', 'Nora', 'Sam']) {
        await userEvent.click(within(rowOf(name)).getByText(name));
      }

      expect(save().disabled).toBe(true);
    });

    it('creates the payment, clears the draft and leaves the three steps', async () => {
      const { draft, store, location } = await setup();
      const historyGo = vi.spyOn(location, 'historyGo').mockImplementation(() => undefined);
      await userEvent.click(within(rowOf('Nora')).getByText('Nora'));

      await userEvent.click(save());

      expect(store.create).toHaveBeenCalledWith({
        groupId: 7,
        payerMemberId: 12,
        title: 'Payment, 26 Oct',
        paidAt: new Date(2026, 9, 26, 15, 30).toISOString(),
        fullAmount: 2450,
        splitType: 'equal',
        participants: [11, 12, 13, 15].map((memberId) => ({ memberId, inputValue: 0 })),
      });
      expect(draft.active()).toBe(false);
      expect(historyGo).toHaveBeenCalledWith(-3);
    });

    it('updates the payment in edit mode and goes back to the details', async () => {
      const { draft, store, location } = await setup('edit');
      const historyGo = vi.spyOn(location, 'historyGo').mockImplementation(() => undefined);

      await userEvent.click(save());

      expect(store.update).toHaveBeenCalledWith(
        7,
        5,
        expect.objectContaining({ title: 'Dinner', paidAt: PAYMENT.paidAt, fullAmount: 2450 }),
      );
      expect(draft.active()).toBe(false);
      expect(historyGo).toHaveBeenCalledWith(-1);
    });

    it('goes to the group, replacing the url, when the new flow was not entered in-app', async () => {
      const { draft, store, location, router } = await setup();
      draft.enteredDirectly.set(true);
      const historyGo = vi.spyOn(location, 'historyGo').mockImplementation(() => undefined);
      const navigate = vi.spyOn(router, 'navigateByUrl');

      await userEvent.click(save());

      expect(store.create).toHaveBeenCalledTimes(1);
      expect(historyGo).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/group/7', { replaceUrl: true });
      await waitFor(() => {
        expect(router.url).toBe('/group/7');
      });
    });

    it('goes to the details, replacing the url, when edit was opened directly', async () => {
      const { draft, store, location, router } = await setup('edit');
      draft.enteredDirectly.set(true);
      const historyGo = vi.spyOn(location, 'historyGo').mockImplementation(() => undefined);
      const navigate = vi.spyOn(router, 'navigateByUrl');

      await userEvent.click(save());

      expect(store.update).toHaveBeenCalledTimes(1);
      expect(historyGo).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/group/7/payments/5', { replaceUrl: true });
      await waitFor(() => {
        expect(router.url).toBe('/group/7/payments/5');
      });
    });
  });
});

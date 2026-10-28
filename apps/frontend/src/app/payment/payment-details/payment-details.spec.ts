import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type ExpenseGroupSummary,
  type GroupEvent,
  type GroupMember,
  type MeResponse,
  type PaymentResponse,
  type PaymentShareResponse,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { routes } from 'src/app/app.routes';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { FeedStore } from 'src/app/feed/feed-store';
import { MemberApiService } from 'src/app/member/member-api.service';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { paymentMeta } from 'src/app/payment/payment-meta';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { ToastService } from 'src/app/shared/toast.service';

import { PaymentDetails } from './payment-details';

@Component({ template: '' })
class Blank {}

const GROUP: ExpenseGroupSummary = {
  id: 7,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
  { id: 13, userId: 3, name: 'Tom', nickname: null, isModerator: false },
];

const PAYMENT: PaymentResponse = {
  id: 5,
  groupId: 7,
  payerMemberId: 12,
  title: 'Groceries',
  paidAt: new Date(2026, 9, 25, 12).toISOString(),
  fullAmount: 2450,
  splitType: 'equal',
  createdAt: '2026-10-25T12:00:00.000Z',
};

const SHARES: PaymentShareResponse[] = [
  { paymentId: 5, memberId: 11, inputValue: 0, amount: 1225 },
  { paymentId: 5, memberId: 12, inputValue: 0, amount: 1225 },
];

type FindOne = ReturnType<typeof vi.fn<(id: number) => Observable<PaymentResponse>>>;

interface Setup {
  findOne: FindOne;
  remove: ReturnType<typeof vi.fn<(groupId: number, id: number) => void>>;
  pending: WritableSignal<UpdatePaymentBody | null>;
  confirm: (body: UpdatePaymentBody | null) => void;
  clear: ReturnType<typeof vi.fn<() => void>>;
  router: Router;
  harness: RouterTestingHarness;
  events: Subject<GroupEvent>;
  message: ReturnType<typeof vi.fn<(text: string) => void>>;
}

async function setup({
  payment = PAYMENT,
  findOne = vi.fn<(id: number) => Observable<PaymentResponse>>().mockReturnValue(of(payment)),
  from,
  pendingBody = null,
}: {
  payment?: PaymentResponse;
  findOne?: FindOne;
  from?: string;
  pendingBody?: UpdatePaymentBody | null;
} = {}): Promise<Setup> {
  const remove = vi.fn<(groupId: number, id: number) => void>();
  const pending = signal<UpdatePaymentBody | null>(pendingBody);
  let confirmed: UpdatePaymentBody | null = null;
  const confirm = (body: UpdatePaymentBody | null): void => {
    confirmed = body;
  };
  const clear = vi.fn<() => void>();
  const events = new Subject<GroupEvent>();
  const message = vi.fn<(text: string) => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'group/:groupId', component: Blank },
          { path: 'group/:groupId/payments/:paymentId', component: PaymentDetails },
          { path: 'group/:groupId/payments/:paymentId/edit/options', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: PaymentApiService, useValue: { findOne, sharesOf: () => of(SHARES) } },
      { provide: MemberApiService, useValue: { listByGroup: () => of(MEMBERS) } },
      { provide: ExpenseGroupApiService, useValue: { findOne: () => of(GROUP) } },
      { provide: AuthApiService, useValue: { me: () => of(ME) } },
      {
        provide: FeedStore,
        useValue: { remove, pendingUpdate: () => pending, confirmedUpdate: () => confirmed },
      },
      { provide: PaymentDraft, useValue: { clear } },
      { provide: RealtimeService, useValue: { events } },
      { provide: ToastService, useValue: { message } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  if (from) {
    await openFirstPage(harness, from);
    await harness.navigateByUrl('/group/7/payments/5');
  } else {
    await openFirstPage(harness, '/group/7/payments/5');
  }
  harness.detectChanges();
  return {
    findOne,
    remove,
    pending,
    confirm,
    clear,
    router: TestBed.inject(Router),
    harness,
    events,
    message,
  };
}

const failingWith = (status: number): FindOne =>
  vi
    .fn<(id: number) => Observable<PaymentResponse>>()
    .mockReturnValue(throwError(() => new HttpErrorResponse({ status })));

describe('PaymentDetails', () => {
  it('shows the amount, the title and who paid when, split how', async () => {
    await setup();

    expect(screen.getByText('€24.50').closest('[appFigure]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy();
    expect(screen.getByText(paymentMeta(PAYMENT, MEMBERS, ME.id))).toBeTruthy();
  });

  it('lists every member under Shares, with — for members outside the payment', async () => {
    await setup();

    const shares = screen.getByRole('list', { name: 'Shares' });
    const rows = within(shares).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent.replace(/\s+/g, ''))).toEqual([
      'You€12.25',
      'Léa€12.25',
      'Tom—',
    ]);
  });

  it('shows a pending edit before the server confirms it', async () => {
    await setup({
      pendingBody: {
        payerMemberId: 11,
        title: 'Market',
        paidAt: new Date(2026, 9, 24, 12).toISOString(),
        fullAmount: 3000,
        splitType: 'shares',
        participants: [
          { memberId: 11, inputValue: 2 },
          { memberId: 13, inputValue: 1 },
        ],
      },
    });

    expect(screen.getByText('€30.00')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Market' })).toBeTruthy();
    expect(
      screen.getByText(
        paymentMeta(
          {
            payerMemberId: 11,
            paidAt: new Date(2026, 9, 24, 12).toISOString(),
            splitType: 'shares',
          },
          MEMBERS,
          ME.id,
        ),
      ),
    ).toBeTruthy();
    const rows = within(screen.getByRole('list', { name: 'Shares' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent.replace(/\s+/g, ''))).toEqual([
      'You€20.00',
      'Léa—',
      'Tom€10.00',
    ]);
  });

  it('fetches the payment again once a pending edit settles', async () => {
    const { findOne, pending, harness } = await setup({
      pendingBody: {
        payerMemberId: 12,
        title: 'Market',
        paidAt: PAYMENT.paidAt,
        fullAmount: 2450,
        splitType: 'equal',
        participants: [{ memberId: 12 }],
      },
    });
    findOne.mockReturnValue(of({ ...PAYMENT, title: 'Market' }));

    pending.set(null);
    harness.detectChanges();

    expect(findOne).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'Market' })).toBeTruthy();
  });

  it('keeps showing a confirmed edit while the payment is fetched again', async () => {
    const edited: UpdatePaymentBody = {
      payerMemberId: 11,
      title: 'Market',
      paidAt: PAYMENT.paidAt,
      fullAmount: 3000,
      splitType: 'equal',
      participants: [{ memberId: 11 }, { memberId: 12 }],
    };
    const { findOne, pending, confirm, harness } = await setup({ pendingBody: edited });
    const refetch = new Subject<PaymentResponse>();
    findOne.mockReturnValue(refetch);

    confirm(edited);
    pending.set(null);
    harness.detectChanges();

    expect(screen.getByRole('heading', { name: 'Market' })).toBeTruthy();
    expect(screen.getByText('€30.00')).toBeTruthy();

    refetch.next({ ...PAYMENT, title: 'Market (server)', fullAmount: 3000 });
    refetch.complete();
    harness.detectChanges();

    expect(screen.getByRole('heading', { name: 'Market (server)' })).toBeTruthy();
  });

  it('shows the stored payment again once a pending edit is refused', async () => {
    const { findOne, pending, harness } = await setup({
      pendingBody: {
        payerMemberId: 12,
        title: 'Market',
        paidAt: PAYMENT.paidAt,
        fullAmount: 2450,
        splitType: 'equal',
        participants: [{ memberId: 12 }],
      },
    });
    findOne.mockReturnValue(new Subject());

    pending.set(null);
    harness.detectChanges();

    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeTruthy();
  });

  it('disables Edit while an edit of this payment is pending', async () => {
    const { pending, harness } = await setup({
      pendingBody: {
        payerMemberId: 12,
        title: 'Market',
        paidAt: PAYMENT.paidAt,
        fullAmount: 2450,
        splitType: 'equal',
        participants: [{ memberId: 12 }],
      },
    });

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit' }).disabled).toBe(true);

    pending.set(null);
    harness.detectChanges();

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Edit' }).disabled).toBe(false);
  });

  it('clears the draft before opening the edit options', async () => {
    const { clear, router } = await setup();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(router.url).toBe('/group/7/payments/5/edit/options');
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('asks for confirmation before deleting', async () => {
    const { remove } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'Delete "Groceries"?' })).toBeTruthy();
    expect(screen.getByText("Everyone's balances will be updated.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes and goes back to the group on confirm', async () => {
    const { remove } = await setup({ from: '/group/7' });
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(remove).toHaveBeenCalledWith(7, 5);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('deletes and falls back to the group on a fresh open', async () => {
    const { remove, router } = await setup();
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(remove).toHaveBeenCalledWith(7, 5);
    expect(navigateByUrl).toHaveBeenCalledWith('/group/7', { replaceUrl: true });
  });

  it('closes the sheet on cancel without deleting', async () => {
    const { remove } = await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete "Groceries"?' })).toBeNull();
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('back goes to the group on a fresh open', async () => {
    const { router } = await setup();
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(navigateByUrl).toHaveBeenCalledWith('/group/7', { replaceUrl: true });
  });

  it('shows skeletons while loading', async () => {
    await setup({
      findOne: vi.fn<(id: number) => Observable<PaymentResponse>>(() => new Subject()),
    });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it.each([404, 403])('says the payment no longer exists on a %i', async (status) => {
    const { router } = await setup({ findOne: failingWith(status) });

    expect(screen.getByText('This payment no longer exists')).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: 'Back to group' }));

    await waitFor(() => {
      expect(router.url).toBe('/group/7');
    });
  });

  it('shows an error with retry', async () => {
    const findOne = vi
      .fn<(id: number) => Observable<PaymentResponse>>()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(PAYMENT));
    await setup({ findOne });

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Groceries' })).toBeTruthy();
    expect(findOne).toHaveBeenCalledTimes(2);
  });
});

describe('payment details route', () => {
  it('opens at group/:groupId/payments/:paymentId alongside the payment form routes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        {
          provide: PaymentApiService,
          useValue: { findOne: () => of(PAYMENT), sharesOf: () => of(SHARES) },
        },
        { provide: MemberApiService, useValue: { listByGroup: () => of(MEMBERS) } },
        { provide: ExpenseGroupApiService, useValue: { findOne: () => of(GROUP) } },
        { provide: AuthApiService, useValue: { me: () => of(ME) } },
      ],
    });
    const harness = await RouterTestingHarness.create();

    const details = await harness.navigateByUrl('/group/7/payments/5', PaymentDetails);

    expect(details).toBeInstanceOf(PaymentDetails);
  });

  describe('live changes', () => {
    it('shows their values, not my confirmed edit, when someone else saves and the refetch fails', async () => {
      const edited: UpdatePaymentBody = {
        payerMemberId: 11,
        title: 'Mine',
        paidAt: PAYMENT.paidAt,
        fullAmount: 3000,
        splitType: 'equal',
        participants: [{ memberId: 11 }, { memberId: 12 }],
      };
      const { findOne, pending, confirm, harness, events } = await setup({ pendingBody: edited });
      confirm(edited);
      findOne.mockReturnValue(new Subject<PaymentResponse>());
      pending.set(null);
      harness.detectChanges();
      expect(screen.getByRole('heading', { name: 'Mine' })).toBeTruthy();

      findOne.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      events.next({
        type: 'payment.saved',
        groupId: 7,
        opId: null,
        payment: { ...PAYMENT, title: 'Theirs' },
      });
      harness.detectChanges();

      expect(screen.getByRole('heading', { name: 'Theirs' })).toBeTruthy();
    });

    it('shows the new title when someone else edits the payment', async () => {
      const findOne = vi
        .fn<(id: number) => Observable<PaymentResponse>>()
        .mockReturnValueOnce(of(PAYMENT))
        .mockReturnValue(of({ ...PAYMENT, title: 'Market' }));
      const { events } = await setup({ findOne });

      events.next({
        type: 'payment.saved',
        groupId: 7,
        opId: null,
        payment: { ...PAYMENT, title: 'Market' },
      });

      expect(await screen.findByRole('heading', { name: 'Market' })).toBeTruthy();
    });

    it('ignores the edit of another payment', async () => {
      const { events, findOne } = await setup();

      events.next({
        type: 'payment.saved',
        groupId: 7,
        opId: null,
        payment: { ...PAYMENT, id: 6 },
      });

      expect(findOne).toHaveBeenCalledTimes(1);
    });

    it('leaves with a message when someone else deletes the payment', async () => {
      const { events, message, router } = await setup();

      events.next({ type: 'payment.deleted', groupId: 7, opId: null, id: 5 });

      expect(message).toHaveBeenCalledWith('This payment was deleted');
      await waitFor(() => {
        expect(router.url).toBe('/group/7');
      });
    });

    it('says nothing about a payment I deleted myself', async () => {
      const { events, message, router } = await setup();
      vi.spyOn(router, 'navigateByUrl').mockReturnValue(new Promise(() => undefined));

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
      events.next({ type: 'payment.deleted', groupId: 7, opId: 'mine', id: 5 });

      expect(message).not.toHaveBeenCalled();
    });
  });
});

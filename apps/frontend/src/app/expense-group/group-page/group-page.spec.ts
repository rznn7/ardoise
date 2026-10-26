import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type CreateInviteLinkResponse,
  type ExpenseGroupSummary,
  type GroupMember,
  type MeResponse,
} from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { MemberApiService } from 'src/app/member/member-api.service';
import { type FeedPayment, type FeedState, PaymentStore } from 'src/app/payment/payment-store';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { ShareService } from 'src/app/shared/share.service';

import { GroupPage } from './group-page';

@Component({ template: '' })
class Blank {}

const GROUP: ExpenseGroupSummary = {
  id: 7,
  name: 'Lisbon trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ME: MeResponse = { id: 1, name: 'Gabriel', role: 'user' };

const member = (id: number, userId: number, name: string, isModerator = false): GroupMember => ({
  id,
  userId,
  name,
  nickname: null,
  isModerator,
});

const MEMBERS: GroupMember[] = [
  member(11, 1, 'Gabriel', true),
  member(12, 2, 'Léa'),
  member(13, 3, 'Tom'),
];

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

const payment = (overrides: Partial<FeedPayment>): FeedPayment => ({
  id: 1,
  groupId: 7,
  payerMemberId: 11,
  title: 'Dinner',
  paidAt: daysAgo(0),
  fullAmount: 4250,
  splitType: 'equal',
  createdAt: '2026-01-01T00:00:00.000Z',
  pending: false,
  ...overrides,
});

interface Setup {
  feed: WritableSignal<FeedState>;
  load: ReturnType<typeof vi.fn<(groupId: number) => void>>;
  remember: ReturnType<typeof vi.fn<(groupId: number) => void>>;
  skipLaunchRedirect: ReturnType<typeof vi.fn<() => void>>;
  findOne: ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary>>>;
}

async function setup({
  members = MEMBERS,
  feedState = { status: 'loaded', payments: [] },
  findOne = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(GROUP)),
  from,
}: {
  members?: GroupMember[];
  feedState?: FeedState;
  findOne?: Setup['findOne'];
  from?: string;
} = {}): Promise<Setup> {
  const feed = signal<FeedState>(feedState);
  const load = vi.fn<(groupId: number) => void>();
  const remember = vi.fn<(groupId: number) => void>();
  const skipLaunchRedirect = vi.fn<() => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'home', component: Blank },
          { path: 'group/:groupId', component: GroupPage },
          { path: 'group/:groupId/payments/new/amount', component: Blank },
          { path: 'group/:groupId/payments/:paymentId', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: ExpenseGroupApiService, useValue: { findOne } },
      { provide: MemberApiService, useValue: { listByGroup: () => of(members) } },
      { provide: AuthApiService, useValue: { me: () => of(ME) } },
      { provide: PaymentStore, useValue: { feed: () => feed, load } },
      { provide: LastGroupService, useValue: { remember, skipLaunchRedirect } },
      {
        provide: InviteLinkApiService,
        useValue: {
          create: vi
            .fn<() => Observable<CreateInviteLinkResponse>>()
            .mockReturnValue(of({ token: 'abc' })),
        },
      },
      { provide: ClipboardService, useValue: { writeText: () => of(undefined) } },
      { provide: ShareService, useValue: { canShare: () => false, share: () => of(undefined) } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  if (from) {
    await openFirstPage(harness, from);
    await harness.navigateByUrl('/group/7');
  } else {
    await openFirstPage(harness, '/group/7');
  }
  harness.detectChanges();
  return { feed, load, remember, skipLaunchRedirect, findOne };
}

describe('GroupPage', () => {
  it('shows the group name and members, with You for the current user', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Lisbon trip' })).toBeTruthy();
    expect(screen.getByText('You, Léa, Tom')).toBeTruthy();
  });

  it('says Just you so far when the current user is alone', async () => {
    await setup({ members: [member(11, 1, 'Gabriel', true)] });

    expect(screen.getByText('Just you so far')).toBeTruthy();
  });

  it('remembers the group and loads its feed', async () => {
    const { remember, load } = await setup();

    expect(remember).toHaveBeenCalledWith(7);
    expect(load).toHaveBeenCalledWith(7);
  });

  it('groups payments under day headers with payer and amount', async () => {
    await setup({
      feedState: {
        status: 'loaded',
        payments: [
          payment({ id: 1, title: 'Dinner', paidAt: daysAgo(0), payerMemberId: 11 }),
          payment({
            id: 2,
            title: 'Taxi',
            paidAt: daysAgo(1),
            payerMemberId: 12,
            fullAmount: 1800,
          }),
          payment({
            id: 3,
            title: 'Museum',
            paidAt: new Date(2025, 9, 25, 12).toISOString(),
            payerMemberId: 13,
            fullAmount: 3000,
          }),
        ],
      },
    });

    const headers = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent.trim());
    expect(headers).toEqual(['Today', 'Yesterday', 'Sat 25 Oct']);

    const dinner = screen.getByRole('link', { name: /dinner/i });
    expect(within(dinner).getByText('Paid by you')).toBeTruthy();
    expect(within(dinner).getByText('€42.50')).toBeTruthy();

    const taxi = screen.getByRole('link', { name: /taxi/i });
    expect(within(taxi).getByText('Paid by Léa')).toBeTruthy();
    expect(within(taxi).getByText('€18.00')).toBeTruthy();
  });

  it('opens the payment details when a row is tapped', async () => {
    await setup({ feedState: { status: 'loaded', payments: [payment({ id: 5 })] } });

    await userEvent.click(screen.getByRole('link', { name: /dinner/i }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/7/payments/5');
    });
  });

  it('does not link a pending row', async () => {
    await setup({
      feedState: {
        status: 'loaded',
        payments: [payment({ id: -1, title: 'Groceries', pending: true })],
      },
    });

    expect(screen.getByText('Groceries')).toBeTruthy();
    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByText(/paid by/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /groceries/i })).toBeNull();
  });

  it('draws the hero under the status bar', async () => {
    await setup();

    const shell = document.querySelector('app-mobile-shell')!;
    expect(shell.className).not.toContain('safe-area-inset-top');
    expect(document.querySelector('app-group-hero')).toBeTruthy();
  });

  it('keeps the safe areas when the group cannot be opened', async () => {
    await setup({
      findOne: vi
        .fn<() => Observable<ExpenseGroupSummary>>()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))),
    });

    expect(document.querySelector('app-mobile-shell')!.className).toContain('safe-area-inset-top');
  });

  it('shows skeleton rows while the feed loads', async () => {
    await setup({ feedState: { status: 'loading' } });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(document.querySelectorAll('hlm-skeleton').length).toBeGreaterThan(0);
  });

  it('shows an error with retry that reloads the feed', async () => {
    const { load } = await setup({ feedState: { status: 'error' } });

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state', async () => {
    await setup();

    expect(screen.getByText('No payments yet')).toBeTruthy();
  });

  it('adds a payment from the FAB', async () => {
    await setup();

    await userEvent.click(screen.getByRole('link', { name: 'Add a payment' }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/7/payments/new/amount');
    });
  });

  it('lets a moderator invite people from the group menu', async () => {
    await setup();

    await userEvent.click(screen.getByRole('button', { name: 'Group menu' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Invite people' }));

    const urlField = await screen.findByLabelText<HTMLInputElement>(/invite link/i);
    expect(urlField.value.endsWith('/join?token=abc')).toBe(true);
  });

  it('hides the group menu from members who are not moderators', async () => {
    await setup({ members: [member(11, 1, 'Gabriel'), member(12, 2, 'Léa', true)] });

    expect(screen.queryByRole('button', { name: 'Group menu' })).toBeNull();
  });

  it.each([403, 404])('says the group cannot be opened on a %i', async (status) => {
    await setup({
      findOne: vi
        .fn<() => Observable<ExpenseGroupSummary>>()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status }))),
    });

    expect(screen.getByText("You can't open this group")).toBeTruthy();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    await userEvent.click(screen.getByRole('link', { name: /back to groups/i }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/home');
    });
    expect(navigateByUrl.mock.calls[0]?.[1]).toMatchObject({ replaceUrl: true });
  });

  it.each([403, 500])('does not remember a group that fails to load with a %i', async (status) => {
    const { remember, skipLaunchRedirect } = await setup({
      findOne: vi
        .fn<() => Observable<ExpenseGroupSummary>>()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status }))),
    });

    expect(remember).not.toHaveBeenCalled();
    expect(skipLaunchRedirect).toHaveBeenCalled();
  });

  it('offers Back to groups next to Retry when the group fails to load', async () => {
    await setup({
      findOne: vi
        .fn<() => Observable<ExpenseGroupSummary>>()
        .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 }))),
    });
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Back to groups' }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/home');
    });
    expect(navigateByUrl.mock.calls[0]?.[1]).toMatchObject({ replaceUrl: true });
  });

  it('shows an error with retry when the group fails to load', async () => {
    const findOne = vi
      .fn<() => Observable<ExpenseGroupSummary>>()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValue(of(GROUP));
    await setup({ findOne });

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByRole('heading', { name: 'Lisbon trip' })).toBeTruthy();
  });

  it('back goes to the previous page when there is one', async () => {
    await setup({ from: '/home' });
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    await userEvent.click(screen.getByRole('button', { name: 'Back to groups' }));

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('back falls back to home on a fresh open', async () => {
    await setup();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Back to groups' }));

    expect(navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('keeps the hero loading until the group arrives', async () => {
    await setup({
      findOne: vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(new Subject()),
    });

    expect(screen.queryByRole('heading', { name: 'Lisbon trip' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });
});

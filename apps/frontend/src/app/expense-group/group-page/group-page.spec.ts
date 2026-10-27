import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type CreateInviteLinkResponse,
  type CreateSettlementBody,
  type ExpenseGroupSummary,
  type GroupBalancesResponse,
  type GroupMember,
  type MeResponse,
  type PaymentResponse,
  type SettlementResponse,
} from '@ardoise/shared';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { BalanceApiService } from 'src/app/balance/balance-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { type FeedRow, type FeedState, FeedStore } from 'src/app/feed/feed-store';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { MemberApiService } from 'src/app/member/member-api.service';
import { type DoneState, DoneStore } from 'src/app/settlement/done-store';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { openFirstPage } from 'src/app/shared/navigation/first-page.testing';
import { ShareService } from 'src/app/shared/share.service';
import { LoadMore } from 'src/app/shared/ui/load-more/load-more';

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

const payment = ({
  pending = false,
  ...overrides
}: Partial<PaymentResponse> & { pending?: boolean }): FeedRow => ({
  kind: 'payment',
  pending,
  payment: {
    id: 1,
    groupId: 7,
    payerMemberId: 11,
    title: 'Dinner',
    paidAt: daysAgo(0),
    fullAmount: 4250,
    splitType: 'equal',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  },
});

const settlement = ({
  pending = false,
  ...overrides
}: Partial<SettlementResponse> & { pending?: boolean }): FeedRow => ({
  kind: 'settlement',
  pending,
  settlement: {
    id: 9,
    groupId: 7,
    fromMemberId: 13,
    toMemberId: 11,
    amount: 1200,
    settledAt: daysAgo(0),
    createdByMemberId: 13,
    createdAt: daysAgo(0),
    ...overrides,
  },
});

const balancesOf = (mine: number): GroupBalancesResponse => ({
  balances: [
    { memberId: 11, amount: mine },
    { memberId: 12, amount: -mine },
    { memberId: 13, amount: 0 },
  ],
  transfers:
    mine === 0
      ? []
      : mine < 0
        ? [{ fromMemberId: 11, toMemberId: 12, amount: -mine }]
        : [{ fromMemberId: 12, toMemberId: 11, amount: mine }],
});

const WITH_PAYMENT: FeedState = { status: 'loaded', more: 'end', rows: [payment({})] };

interface Setup {
  feed: WritableSignal<FeedState>;
  settled: WritableSignal<number>;
  listBalances: ReturnType<typeof vi.fn<() => Observable<GroupBalancesResponse>>>;
  load: ReturnType<typeof vi.fn<(groupId: number) => void>>;
  remember: ReturnType<typeof vi.fn<(groupId: number) => void>>;
  skipLaunchRedirect: ReturnType<typeof vi.fn<() => void>>;
  findOne: ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary>>>;
  recordSettlement: ReturnType<typeof vi.fn<(body: CreateSettlementBody) => void>>;
  undoSettlement: ReturnType<typeof vi.fn<(groupId: number, id: number) => void>>;
  loadMoreFeed: ReturnType<typeof vi.fn<() => void>>;
  loadMoreDone: ReturnType<typeof vi.fn<() => void>>;
  harness: RouterTestingHarness;
}

const settlementsOf = (row: FeedRow) => (row.kind === 'settlement' ? [row.settlement] : []);

const doneOf = (feed: FeedState): DoneState =>
  feed.status === 'loaded'
    ? {
        status: 'loaded',
        more: 'end',
        settlements: feed.rows.flatMap((row) =>
          row.kind === 'settlement' && !row.pending ? [row.settlement] : [],
        ),
      }
    : feed;

async function setup({
  members = MEMBERS,
  feedState = { status: 'loaded', more: 'end', rows: [] },
  findOne = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(GROUP)),
  balances = balancesOf(0),
  url = '/group/7',
  from,
  doneState = doneOf(feedState),
}: {
  members?: GroupMember[];
  feedState?: FeedState;
  doneState?: DoneState;
  findOne?: Setup['findOne'];
  balances?: GroupBalancesResponse | Observable<GroupBalancesResponse>;
  url?: string;
  from?: string;
} = {}): Promise<Setup> {
  const feed = signal<FeedState>(feedState);
  const settled = signal(0);
  const listBalances = vi
    .fn<() => Observable<GroupBalancesResponse>>()
    .mockReturnValue('balances' in balances ? of(balances) : balances);
  const load = vi.fn<(groupId: number) => void>();
  const remember = vi.fn<(groupId: number) => void>();
  const skipLaunchRedirect = vi.fn<() => void>();
  const recordSettlement = vi.fn<(body: CreateSettlementBody) => void>();
  const undoSettlement = vi.fn<(groupId: number, id: number) => void>();
  const loadMoreFeed = vi.fn<() => void>();
  const loadMoreDone = vi.fn<() => void>();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'home', component: Blank },
          { path: 'group/:groupId', component: GroupPage },
          { path: 'group/:groupId/payments/new/amount', component: Blank },
          { path: 'group/:groupId/payments/:paymentId', component: Blank },
          { path: 'group/:groupId/settlements/:settlementId', component: Blank },
        ],
        withComponentInputBinding(),
        withHistoryPageIds(),
      ),
      { provide: ExpenseGroupApiService, useValue: { findOne } },
      { provide: MemberApiService, useValue: { listByGroup: () => of(members) } },
      { provide: AuthApiService, useValue: { me: () => of(ME) } },
      {
        provide: FeedStore,
        useValue: {
          feed: () => feed,
          loadFirst: load,
          loadMore: loadMoreFeed,
          retryMore: vi.fn(),
          settledVersion: () => settled,
          pendingSettlements: () => signal([]),
          recordSettlement,
          undoSettlement,
        },
      },
      {
        provide: DoneStore,
        useValue: {
          done: () => signal(doneState),
          loadFirst: vi.fn(),
          loadMore: loadMoreDone,
          retryMore: vi.fn(),
        },
      },
      { provide: BalanceApiService, useValue: { listByGroup: listBalances } },
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
    await harness.navigateByUrl(url);
  } else {
    await openFirstPage(harness, url);
  }
  harness.detectChanges();
  return {
    feed,
    settled,
    listBalances,
    load,
    remember,
    skipLaunchRedirect,
    findOne,
    recordSettlement,
    undoSettlement,
    loadMoreFeed,
    loadMoreDone,
    harness,
  };
}

const reachBottom = (harness: RouterTestingHarness, at: string): void => {
  const [loadMore] = harness.fixture.debugElement
    .queryAll(By.directive(LoadMore))
    .filter((el) => (el.nativeElement as HTMLElement).closest(at) !== null);
  if (!loadMore) throw new Error(`no load-more in ${at}`);
  (loadMore.componentInstance as LoadMore).reached.emit();
};

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

  it('asks the feed for the next page at the bottom of the list', async () => {
    const { harness, loadMoreFeed } = await setup({
      feedState: { ...WITH_PAYMENT, more: 'idle' },
    });

    reachBottom(harness, 'app-group-page');

    expect(loadMoreFeed).toHaveBeenCalledTimes(1);
  });

  it('groups payments under day headers with payer and amount', async () => {
    await setup({
      feedState: {
        status: 'loaded',
        more: 'end',
        rows: [
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
    await setup({ feedState: { status: 'loaded', more: 'end', rows: [payment({ id: 5 })] } });

    await userEvent.click(screen.getByRole('link', { name: /dinner/i }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/7/payments/5');
    });
  });

  it('does not link a pending row', async () => {
    await setup({
      feedState: {
        status: 'loaded',
        more: 'end',
        rows: [payment({ id: -1, title: 'Groceries', pending: true })],
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

  it('sizes the FAB like every floating action', async () => {
    await setup();

    const fab = screen.getByRole('link', { name: 'Add a payment' });
    expect(fab.classList).toContain('h-14');
    expect(fab.classList).toContain('min-w-14');
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

  it('lists a repayment in the feed with its marker', async () => {
    await setup({ feedState: { status: 'loaded', more: 'end', rows: [settlement({})] } });

    const row = screen.getByRole('link', { name: /tom paid you back/i });
    expect(within(row).getByText('Repayment')).toBeTruthy();
    expect(within(row).getByText('€12.00')).toBeTruthy();

    await userEvent.click(row);
    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/7/settlements/9');
    });
  });

  it('does not link a repayment that is still saving', async () => {
    await setup({
      feedState: { status: 'loaded', more: 'end', rows: [settlement({ id: -2, pending: true })] },
    });

    expect(screen.getByText('Tom paid you back')).toBeTruthy();
    expect(screen.getByText('Saving…')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /tom paid you back/i })).toBeNull();
  });

  it('keeps the hero loading until the group arrives', async () => {
    await setup({
      findOne: vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(new Subject()),
    });

    expect(screen.queryByRole('heading', { name: 'Lisbon trip' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  describe('balance', () => {
    it('shows what I owe under the members', async () => {
      await setup({ feedState: WITH_PAYMENT, balances: balancesOf(-1500) });

      const balance = await screen.findByRole('button', { name: /you owe/i });
      expect(within(balance).getByText('€15.00')).toBeTruthy();
    });

    it('shows what I am owed', async () => {
      await setup({ feedState: WITH_PAYMENT, balances: balancesOf(1500) });

      const balance = await screen.findByRole('button', { name: /owed to you/i });
      expect(within(balance).getByText('€15.00')).toBeTruthy();
    });

    it('shows Settled up at zero once there are payments', async () => {
      await setup({ feedState: WITH_PAYMENT, balances: balancesOf(0) });

      const balance = await screen.findByRole('button', { name: /settled up/i });
      expect(within(balance).getByText('€0.00')).toBeTruthy();
    });

    it('shows no balance in a group without payments', async () => {
      await setup({ balances: balancesOf(0) });

      expect(screen.queryByRole('button', { name: /settled up/i })).toBeNull();
    });

    it('shows the balance when only repayments are left', async () => {
      await setup({
        feedState: { status: 'loaded', more: 'end', rows: [settlement({})] },
        balances: balancesOf(-1200),
      });

      const balance = await screen.findByRole('button', { name: /you owe/i });
      expect(within(balance).getByText('€12.00')).toBeTruthy();
    });

    it('hides the balance when it cannot load', async () => {
      await setup({
        feedState: WITH_PAYMENT,
        balances: throwError(() => new HttpErrorResponse({ status: 500 })),
      });

      expect(screen.queryByRole('button', { name: /you owe|owed to you|settled up/i })).toBeNull();
    });

    it('opens the balances tab from the hero balance', async () => {
      await setup({ feedState: WITH_PAYMENT, balances: balancesOf(-1500) });

      await userEvent.click(await screen.findByRole('button', { name: /you owe/i }));

      expect(await screen.findByText('You pay Léa')).toBeTruthy();
      expect(TestBed.inject(Location).path()).toBe('/group/7?tab=balances');
    });

    it('opens directly on the balances tab from the URL', async () => {
      await setup({
        feedState: WITH_PAYMENT,
        balances: balancesOf(-1500),
        url: '/group/7?tab=balances',
      });

      expect(await screen.findByText('You pay Léa')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /dinner/i })).toBeNull();
    });

    it('switches tabs without adding a history entry', async () => {
      await setup({ feedState: WITH_PAYMENT, balances: balancesOf(-1500), from: '/home' });
      const location = TestBed.inject(Location);
      const go = vi.spyOn(location, 'go');

      await userEvent.click(screen.getByRole('button', { name: 'Balances' }));
      await waitFor(() => {
        expect(location.path()).toBe('/group/7?tab=balances');
      });
      await userEvent.click(screen.getByRole('button', { name: 'Payments' }));
      await waitFor(() => {
        expect(location.path()).toBe('/group/7');
      });

      expect(go).not.toHaveBeenCalled();
    });

    it('records a repayment confirmed from the balances tab', async () => {
      const { recordSettlement } = await setup({
        feedState: WITH_PAYMENT,
        balances: balancesOf(-1500),
        url: '/group/7?tab=balances',
      });

      await userEvent.click(await screen.findByRole('button', { name: /you pay léa/i }));
      await userEvent.click(await screen.findByRole('button', { name: 'I paid Léa back' }));

      expect(recordSettlement).toHaveBeenCalledWith({
        groupId: 7,
        fromMemberId: 11,
        toMemberId: 12,
        amount: 1500,
      });
    });

    it('keeps a confirmed repayment locked until balances come back', async () => {
      const { listBalances, settled } = await setup({
        feedState: WITH_PAYMENT,
        balances: balancesOf(-1500),
        url: '/group/7?tab=balances',
      });
      expect(await screen.findByRole('button', { name: /you pay léa/i })).toBeTruthy();
      listBalances.mockReturnValue(new Subject());

      settled.set(1);
      TestBed.tick();

      expect(screen.queryByRole('button', { name: /you pay léa/i })).toBeNull();
      expect(screen.getByText('You pay Léa')).toBeTruthy();
    });

    it('lists Done from the Done store, not from the loaded feed', async () => {
      await setup({
        feedState: WITH_PAYMENT,
        doneState: {
          status: 'loaded',
          more: 'idle',
          settlements: settlementsOf(settlement({ id: 9 })),
        },
        url: '/group/7?tab=balances',
      });

      expect(await screen.findByRole('button', { name: /tom paid you back/i })).toBeTruthy();
    });

    it('asks the Done store for more at the bottom of Done', async () => {
      const { harness, loadMoreDone } = await setup({
        feedState: WITH_PAYMENT,
        doneState: {
          status: 'loaded',
          more: 'idle',
          settlements: settlementsOf(settlement({ id: 9 })),
        },
        url: '/group/7?tab=balances',
      });
      await screen.findByRole('button', { name: /tom paid you back/i });

      reachBottom(harness, 'app-group-balances');

      expect(loadMoreDone).toHaveBeenCalledTimes(1);
    });

    it('undoes a repayment from the Done section', async () => {
      const { undoSettlement } = await setup({
        feedState: { status: 'loaded', more: 'end', rows: [payment({}), settlement({ id: 9 })] },
        balances: balancesOf(0),
        url: '/group/7?tab=balances',
      });

      await userEvent.click(await screen.findByRole('button', { name: /tom paid you back/i }));
      await userEvent.click(await screen.findByRole('button', { name: 'Undo repayment' }));

      expect(undoSettlement).toHaveBeenCalledWith(7, 9);
    });

    it('reloads balances when a payment change settles', async () => {
      const { settled, listBalances } = await setup({ feedState: WITH_PAYMENT });
      expect(listBalances).toHaveBeenCalledTimes(1);

      settled.set(1);
      TestBed.tick();

      expect(listBalances).toHaveBeenCalledTimes(2);
    });
  });

  describe('balances tab while payments are not known', () => {
    it('stays loading until the payments arrive', async () => {
      await setup({
        feedState: { status: 'loading' },
        balances: balancesOf(0),
        url: '/group/7?tab=balances',
      });

      expect(await screen.findByRole('status', { name: 'Loading' })).toBeTruthy();
      expect(screen.queryByText('Nothing to settle yet')).toBeNull();
    });

    it('shows an error with retry when the payments fail', async () => {
      const { load, listBalances } = await setup({
        feedState: { status: 'error' },
        balances: balancesOf(-1500),
        url: '/group/7?tab=balances',
      });

      expect(await screen.findByText("Couldn't load balances")).toBeTruthy();
      expect(screen.queryByText('Nothing to settle yet')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(load).toHaveBeenCalledTimes(2);
      expect(listBalances).toHaveBeenCalledTimes(2);
    });

    it('does not count a payment that is still saving', async () => {
      await setup({
        feedState: { status: 'loaded', more: 'end', rows: [payment({ id: -1, pending: true })] },
        balances: balancesOf(0),
        url: '/group/7?tab=balances',
      });

      expect(await screen.findByText('Nothing to settle yet')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /settled up/i })).toBeNull();
    });
  });
});

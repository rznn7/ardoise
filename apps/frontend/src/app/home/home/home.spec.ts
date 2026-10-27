import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  type CreateInviteLinkResponse,
  type ExpenseGroupSummary,
  type MyBalance,
} from '@ardoise/shared';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { BalanceApiService } from 'src/app/balance/balance-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { LastGroupService } from 'src/app/expense-group/last-group.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';

import { Home } from './home';

type ListMineMock = ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary[]>>>;
type CreateMock = ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary>>>;
type TakeLaunchRedirectMock = ReturnType<typeof vi.fn<() => number | null>>;

@Component({ template: '' })
class Blank {}

const NEW_GROUP: ExpenseGroupSummary = {
  id: 99,
  name: 'New',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function setup({
  listMine = vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of([])),
  create = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(NEW_GROUP)),
  takeLaunchRedirect = vi.fn<() => number | null>().mockReturnValue(null),
  balances = of([]),
  role = 'user',
}: {
  balances?: Observable<MyBalance[]>;
  role?: 'user' | 'admin';
  listMine?: ListMineMock;
  create?: CreateMock;
  takeLaunchRedirect?: TakeLaunchRedirectMock;
} = {}): Promise<{
  listMine: ListMineMock;
  create: CreateMock;
  home: Home;
}> {
  const { fixture } = await render(Home, {
    providers: [
      { provide: ExpenseGroupApiService, useValue: { listMine, create } },
      {
        provide: InviteLinkApiService,
        useValue: {
          create: vi
            .fn<() => Observable<CreateInviteLinkResponse>>()
            .mockReturnValue(of({ token: 'abc' })),
        },
      },
      { provide: LastGroupService, useValue: { takeLaunchRedirect } },
      { provide: BalanceApiService, useValue: { listMine: () => balances } },
      provideRouter([
        { path: 'group/:groupId', component: Blank },
        { path: 'admin', component: Blank },
      ]),
      {
        provide: AuthService,
        useValue: { currentUser: () => of({ id: 1, name: 'Ada', role }) },
      },
    ],
  });
  return { listMine, create, home: fixture.componentInstance };
}

const TWO_GROUPS: ExpenseGroupSummary[] = [
  { id: 1, name: 'Trip', currencyCode: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 2, name: 'Flat', currencyCode: 'EUR', createdAt: '2026-01-02T00:00:00.000Z' },
];

describe('Home', () => {
  it('shows the Admin button only to admins', async () => {
    await setup({ role: 'admin' });

    await userEvent.click(screen.getByRole('link', { name: 'Admin' }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/admin');
    });
  });

  it('hides the Admin button from plain users', async () => {
    await setup();

    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('shows a loading skeleton while groups load', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(new Subject()),
    });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
    expect(screen.queryByText(/no groups yet/i)).toBeNull();
  });

  it('renders a row per group', async () => {
    const groups: ExpenseGroupSummary[] = [
      { id: 1, name: 'Trip', currencyCode: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, name: 'Flat', currencyCode: 'EUR', createdAt: '2026-01-02T00:00:00.000Z' },
    ];
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of(groups)),
    });

    expect(screen.getByText('Trip')).toBeTruthy();
    expect(screen.getByText('Flat')).toBeTruthy();

    const slots = screen.getAllByTestId('balance-slot');
    expect(slots).toHaveLength(2);
    slots.forEach((slot) => {
      expect(slot.textContent.trim()).toBe('');
    });
  });

  it('shows the empty state when there are no groups', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of([])),
    });

    expect(screen.getByText('No groups yet')).toBeTruthy();
    expect(
      screen.getByText(/create a group to start splitting expenses with friends/i),
    ).toBeTruthy();
  });

  it('shows an error with retry when the fetch fails, and retries', async () => {
    const listMine = vi
      .fn<() => Observable<ExpenseGroupSummary[]>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(
        of([{ id: 1, name: 'Trip', currencyCode: 'EUR', createdAt: '2026-01-01T00:00:00.000Z' }]),
      );
    await setup({ listMine });

    expect(screen.getByText(/couldn't load your groups/i)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Trip')).toBeTruthy();
    expect(listMine).toHaveBeenCalledTimes(2);
  });

  it('FAB and empty CTA open the create sheet', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of([])),
    });

    await userEvent.click(screen.getByRole('button', { name: /create a group/i }));
    const fabDialog = await screen.findByRole('dialog', { name: /create a group/i });
    expect(within(fabDialog).getByLabelText(/name/i)).toBeTruthy();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await userEvent.click(screen.getByRole('button', { name: /create your first group/i }));
    expect(await screen.findByRole('dialog', { name: /create a group/i })).toBeTruthy();
  });

  it('refreshes the list without a spinner when a group is created', async () => {
    const flat: ExpenseGroupSummary = {
      id: 1,
      name: 'Flat',
      currencyCode: 'EUR',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const trip: ExpenseGroupSummary = {
      id: 2,
      name: 'Trip',
      currencyCode: 'EUR',
      createdAt: '2026-01-02T00:00:00.000Z',
    };
    const refetch = new Subject<ExpenseGroupSummary[]>();
    const listMine = vi
      .fn<() => Observable<ExpenseGroupSummary[]>>()
      .mockReturnValueOnce(of([flat]))
      .mockReturnValueOnce(refetch);
    await setup({
      listMine,
      create: vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(trip)),
    });

    await userEvent.click(screen.getByRole('button', { name: /create a group/i }));
    const dialog = await screen.findByRole('dialog', { name: /create a group/i });
    await userEvent.type(within(dialog).getByLabelText(/name/i), 'Trip');
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));

    expect(listMine).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Flat')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    refetch.next([flat, trip]);

    expect(await screen.findByText('Trip')).toBeTruthy();
  });

  it('closes the sheet when done is clicked on the invite step', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of([])),
    });

    await userEvent.click(screen.getByRole('button', { name: /create a group/i }));
    const dialog = await screen.findByRole('dialog', { name: /create a group/i });
    await userEvent.type(within(dialog).getByLabelText(/name/i), 'Trip');
    await userEvent.click(within(dialog).getByRole('button', { name: /^create$/i }));

    await userEvent.click(await screen.findByRole('button', { name: /done/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('opens the remembered group once when it is in the list', async () => {
    const navigateByUrl = vi.spyOn(Router.prototype, 'navigateByUrl');
    const takeLaunchRedirect = vi
      .fn<() => number | null>()
      .mockReturnValueOnce(2)
      .mockReturnValue(null);
    const { home } = await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of(TWO_GROUPS)),
      takeLaunchRedirect,
    });

    home.refresh();

    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/group/2');
    navigateByUrl.mockRestore();
  });

  it('stays home when the remembered group is not in the list', async () => {
    const navigateByUrl = vi.spyOn(Router.prototype, 'navigateByUrl');
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of(TWO_GROUPS)),
      takeLaunchRedirect: vi.fn<() => number | null>().mockReturnValue(42),
    });

    expect(navigateByUrl).not.toHaveBeenCalled();
    navigateByUrl.mockRestore();
  });

  it('opens a group when its row is tapped', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of(TWO_GROUPS)),
    });

    await userEvent.click(screen.getByRole('link', { name: /flat/i }));

    await waitFor(() => {
      expect(TestBed.inject(Router).url).toBe('/group/2');
    });
  });

  describe('balances', () => {
    const slotOf = (name: string): HTMLElement => {
      const link = screen.getByRole('link', { name: new RegExp(name) });
      const slot = link.querySelector<HTMLElement>('[data-testid="balance-slot"]');
      if (!slot) throw new Error(`no balance slot for ${name}`);
      return slot;
    };
    const twoGroups = () =>
      vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of(TWO_GROUPS));

    it('shows my balance on each group row', async () => {
      await setup({
        listMine: twoGroups(),
        balances: of([
          { groupId: 1, amount: -2820 },
          { groupId: 2, amount: 1830 },
        ]),
      });

      expect(slotOf('Trip').textContent.trim()).toBe('−€28.20');
      expect(slotOf('Flat').textContent.trim()).toBe('+€18.30');
    });

    it('leaves the slot empty for a settled group', async () => {
      await setup({
        listMine: twoGroups(),
        balances: of([
          { groupId: 1, amount: 0 },
          { groupId: 2, amount: 500 },
        ]),
      });

      expect(slotOf('Trip').textContent.trim()).toBe('');
    });

    it('still lists the groups when balances fail', async () => {
      await setup({
        listMine: twoGroups(),
        balances: throwError(() => new Error('offline')),
      });

      expect(slotOf('Trip').textContent.trim()).toBe('');
      expect(slotOf('Flat').textContent.trim()).toBe('');
    });
  });
});

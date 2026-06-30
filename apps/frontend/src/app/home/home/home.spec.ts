import { Router } from '@angular/router';
import { type CreateInviteLinkResponse, type ExpenseGroupSummary } from '@ardoise/shared';
import { render, screen, waitForElementToBeRemoved, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';

import { Home } from './home';

type ListMineMock = ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary[]>>>;
type CreateMock = ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary>>>;

const NEW_GROUP: ExpenseGroupSummary = {
  id: 99,
  name: 'New',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function setup({
  listMine = vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(of([])),
  create = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(NEW_GROUP)),
}: { listMine?: ListMineMock; create?: CreateMock } = {}): Promise<{
  listMine: ListMineMock;
  create: CreateMock;
}> {
  await render(Home, {
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
      { provide: Router, useValue: {} },
      { provide: AuthService, useValue: {} },
    ],
  });
  return { listMine, create };
}

describe('Home', () => {
  it('shows a spinner while groups load', async () => {
    await setup({
      listMine: vi.fn<() => Observable<ExpenseGroupSummary[]>>().mockReturnValue(new Subject()),
    });

    expect(screen.getByRole('status')).toBeTruthy();
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
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));

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

    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
  });
});

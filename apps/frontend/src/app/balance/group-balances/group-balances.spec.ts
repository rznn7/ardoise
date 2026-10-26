import { type GroupBalancesResponse, type GroupMember } from '@ardoise/shared';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type BalancesState } from 'src/app/balance/balance-store';

import { GroupBalances } from './group-balances';

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
];

const loaded = (balances: GroupBalancesResponse): BalancesState => ({
  status: 'loaded',
  balances,
});

const OWING = loaded({
  balances: [
    { memberId: 11, amount: -3000 },
    { memberId: 12, amount: 3000 },
  ],
  transfers: [{ fromMemberId: 11, toMemberId: 12, amount: 3000 }],
});

const SETTLED = loaded({
  balances: [
    { memberId: 11, amount: 0 },
    { memberId: 12, amount: 0 },
  ],
  transfers: [],
});

async function renderBalances(state: BalancesState, hasPayments = true) {
  const retry = vi.fn<() => void>();
  await render(GroupBalances, {
    inputs: { state, members: MEMBERS, meUserId: 1, currency: 'EUR', hasPayments },
    on: { retry },
  });
  return { retry };
}

describe('GroupBalances', () => {
  it('lists every member balance and my repayment', async () => {
    await renderBalances(OWING);

    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByText('−€30.00')).toBeTruthy();
    expect(screen.getByText('+€30.00')).toBeTruthy();
    expect(screen.getByText('You pay Léa')).toBeTruthy();
    expect(screen.getByText('€30.00')).toBeTruthy();
  });

  it('says all settled when nobody owes anything', async () => {
    await renderBalances(SETTLED);

    expect(screen.getByText('All settled')).toBeTruthy();
    expect(screen.queryByText('Repayments')).toBeNull();
  });

  it('shows the empty state when the group has no payments', async () => {
    await renderBalances(SETTLED, false);

    expect(screen.getByText('Nothing to settle yet')).toBeTruthy();
    expect(screen.getByText('Add a payment with + to see who owes whom.')).toBeTruthy();
    expect(screen.queryByText('All settled')).toBeNull();
  });

  it('shows a loading state', async () => {
    await renderBalances({ status: 'loading' });

    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy();
  });

  it('offers a retry on error', async () => {
    const { retry } = await renderBalances({ status: 'error' });

    expect(screen.getByText("Couldn't load balances")).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

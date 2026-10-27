import {
  type CreateSettlementBody,
  type GroupBalancesResponse,
  type GroupMember,
  type SettlementResponse,
} from '@ardoise/shared';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type BalancesState } from 'src/app/balance/balance-store';

import { GroupBalances } from './group-balances';

const MEMBERS: GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
  { id: 13, userId: 3, name: 'Tom', nickname: null, isModerator: false },
];

const settlement = (id: number, fromMemberId: number, toMemberId: number): SettlementResponse => ({
  id,
  groupId: 7,
  fromMemberId,
  toMemberId,
  amount: 1500,
  settledAt: new Date().toISOString(),
  createdByMemberId: fromMemberId,
  createdAt: new Date().toISOString(),
});

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

const MIXED = loaded({
  balances: [
    { memberId: 11, amount: -3000 },
    { memberId: 12, amount: 4200 },
    { memberId: 13, amount: -1200 },
  ],
  transfers: [
    { fromMemberId: 11, toMemberId: 12, amount: 3000 },
    { fromMemberId: 13, toMemberId: 12, amount: 1200 },
  ],
});

async function renderBalances(
  state: BalancesState,
  hasActivity = true,
  {
    settlements = [],
    pendingSettlements = [],
    refreshing = false,
  }: {
    settlements?: SettlementResponse[];
    pendingSettlements?: CreateSettlementBody[];
    refreshing?: boolean;
  } = {},
) {
  const retry = vi.fn<() => void>();
  const record =
    vi.fn<(body: { fromMemberId: number; toMemberId: number; amount: number }) => void>();
  const undo = vi.fn<(id: number) => void>();
  await render(GroupBalances, {
    inputs: {
      state,
      members: MEMBERS,
      meUserId: 1,
      currency: 'EUR',
      hasActivity,
      settlements,
      pendingSettlements,
      refreshing,
    },
    on: { retry, record, undo },
  });
  return { retry, record, undo };
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

  it('gives every amount the same width so the bars share one axis', async () => {
    await renderBalances(OWING);

    const amounts = document.querySelectorAll('app-balance-indicator');
    expect(amounts).toHaveLength(2);
    for (const amount of amounts) {
      expect(amount.classList).toContain('w-24');
      expect(amount.classList).toContain('justify-end');
    }
  });

  it('lets names take the free width instead of a narrow fixed column', async () => {
    await renderBalances(OWING);

    const name = screen.getByText('Léa');
    expect(name.classList).toContain('flex-1');
    expect(name.classList).toContain('min-w-0');
    expect(name.classList).toContain('truncate');
  });

  describe('repayments', () => {
    it('makes only my repayment rows tappable', async () => {
      await renderBalances(MIXED);

      expect(screen.getByRole('button', { name: /you pay léa/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /tom pays léa/i })).toBeNull();
      expect(screen.getByText('Tom pays Léa')).toBeTruthy();
    });

    it('confirms a repayment from its sheet', async () => {
      const { record } = await renderBalances(MIXED);

      await userEvent.click(screen.getByRole('button', { name: /you pay léa/i }));
      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByText('You pay Léa')).toBeTruthy();
      expect(within(sheet).getByText('€30.00')).toBeTruthy();
      await userEvent.click(within(sheet).getByRole('button', { name: 'I paid Léa back' }));

      expect(record).toHaveBeenCalledWith({ fromMemberId: 11, toMemberId: 12, amount: 3000 });
    });

    it('closes the sheet without recording on Not yet', async () => {
      const { record } = await renderBalances(MIXED);

      await userEvent.click(screen.getByRole('button', { name: /you pay léa/i }));
      await userEvent.click(await screen.findByRole('button', { name: 'Not yet' }));

      expect(record).not.toHaveBeenCalled();
    });

    it('pending repayment row is not tappable', async () => {
      await renderBalances(MIXED, true, {
        pendingSettlements: [{ groupId: 7, fromMemberId: 11, toMemberId: 12, amount: 3000 }],
      });

      expect(screen.queryByRole('button', { name: /you pay léa/i })).toBeNull();
      expect(screen.getByText('Saving…')).toBeTruthy();
    });

    it('locks my repayment rows while balances refresh', async () => {
      await renderBalances(MIXED, true, { refreshing: true });

      expect(screen.queryByRole('button', { name: /you pay léa/i })).toBeNull();
      expect(screen.getByText('You pay Léa')).toBeTruthy();
    });
  });

  describe('done', () => {
    it('is hidden without recorded repayments', async () => {
      await renderBalances(MIXED);

      expect(screen.queryByText('Done')).toBeNull();
    });

    it('lists recorded repayments, mine tappable, others read only', async () => {
      await renderBalances(MIXED, true, {
        settlements: [settlement(4, 13, 12), settlement(5, 13, 11)],
      });

      expect(screen.getByText('Done')).toBeTruthy();
      expect(screen.getByRole('button', { name: /tom paid you back/i })).toBeTruthy();
      expect(screen.getByText('Tom paid Léa back')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /tom paid léa back/i })).toBeNull();
    });

    it('undoes my repayment from its sheet', async () => {
      const { undo } = await renderBalances(MIXED, true, {
        settlements: [settlement(5, 13, 11)],
      });

      await userEvent.click(screen.getByRole('button', { name: /tom paid you back/i }));
      const sheet = await screen.findByRole('dialog');
      expect(within(sheet).getByText('€15.00')).toBeTruthy();
      await userEvent.click(within(sheet).getByRole('button', { name: 'Undo repayment' }));

      expect(undo).toHaveBeenCalledWith(5);
    });

    it('keeps the repayment on Keep it', async () => {
      const { undo } = await renderBalances(MIXED, true, {
        settlements: [settlement(5, 13, 11)],
      });

      await userEvent.click(screen.getByRole('button', { name: /tom paid you back/i }));
      await userEvent.click(await screen.findByRole('button', { name: 'Keep it' }));

      expect(undo).not.toHaveBeenCalled();
    });

    it('shows Done even when everything is settled', async () => {
      await renderBalances(SETTLED, true, { settlements: [settlement(5, 13, 11)] });

      expect(screen.getByText('All settled')).toBeTruthy();
      expect(screen.getByText('Done')).toBeTruthy();
    });
  });
});

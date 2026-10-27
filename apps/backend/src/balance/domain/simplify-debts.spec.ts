import { describe, expect, it } from 'vitest';

import { type MemberBalance, type Transfer } from './balance';
import { simplifyDebts } from './simplify-debts';

const balances = (entries: Record<number, number>): MemberBalance[] =>
  Object.entries(entries).map(([memberId, amount]) => ({
    memberId: Number(memberId),
    amount,
  }));

const afterTransfers = (
  start: readonly MemberBalance[],
  transfers: readonly Transfer[],
): number[] => {
  const amounts = new Map(start.map((b) => [b.memberId, b.amount]));
  for (const { fromMemberId, toMemberId, amount } of transfers) {
    amounts.set(fromMemberId, (amounts.get(fromMemberId) ?? 0) + amount);
    amounts.set(toMemberId, (amounts.get(toMemberId) ?? 0) - amount);
  }
  return [...amounts.values()];
};

describe('simplifyDebts', () => {
  it('has one debtor repay each creditor', () => {
    expect(simplifyDebts(balances({ 1: 3000, 2: 1500, 3: -4500 }))).toEqual([
      { fromMemberId: 3, toMemberId: 1, amount: 3000 },
      { fromMemberId: 3, toMemberId: 2, amount: 1500 },
    ]);
  });

  it('settles many debtors and creditors in at most members minus one transfers', () => {
    const start = balances({ 1: 8820, 2: 3360, 3: -2110, 4: -4250, 5: -5820 });

    const transfers = simplifyDebts(start);

    expect(afterTransfers(start, transfers).every((a) => a === 0)).toBe(true);
    expect(transfers.length).toBeLessThanOrEqual(4);
    for (const { amount } of transfers) {
      expect(Number.isInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });

  it('needs no transfer when everyone is settled', () => {
    expect(simplifyDebts(balances({ 1: 0, 2: 0 }))).toEqual([]);
  });

  it('breaks ties by lowest member id', () => {
    expect(
      simplifyDebts(balances({ 1: 1000, 2: 1000, 3: -1000, 4: -1000 })),
    ).toEqual([
      { fromMemberId: 3, toMemberId: 1, amount: 1000 },
      { fromMemberId: 4, toMemberId: 2, amount: 1000 },
    ]);
  });
});

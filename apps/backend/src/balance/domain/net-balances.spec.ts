import { describe, expect, it } from 'vitest';

import { UnbalancedLedger } from './balance';
import { netBalances } from './net-balances';

describe('netBalances', () => {
  it('subtracts what each member owes from what they paid', () => {
    expect(
      netBalances([
        { memberId: 1, paid: 3000, owed: 1000 },
        { memberId: 2, paid: 0, owed: 2000 },
      ]),
    ).toEqual([
      { memberId: 1, amount: 2000 },
      { memberId: 2, amount: -2000 },
    ]);
  });

  it('keeps a member with nothing paid or owed at zero', () => {
    expect(
      netBalances([
        { memberId: 1, paid: 500, owed: 500 },
        { memberId: 2, paid: 0, owed: 0 },
      ]),
    ).toEqual([
      { memberId: 1, amount: 0 },
      { memberId: 2, amount: 0 },
    ]);
  });

  it('refuses balances that do not sum to zero', () => {
    expect(() => netBalances([{ memberId: 1, paid: 100, owed: 0 }])).toThrow(
      UnbalancedLedger,
    );
  });

  it('returns nothing for a group without members', () => {
    expect(netBalances([])).toEqual([]);
  });
});

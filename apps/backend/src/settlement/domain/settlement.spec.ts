import { describe, expect, it } from 'vitest';

import {
  assertInvolved,
  assertValidSettlement,
  InvalidSettlement,
  NotInvolvedInSettlement,
} from './settlement';

describe('assertValidSettlement', () => {
  it('accepts a positive amount between two members', () => {
    expect(() =>
      assertValidSettlement({ fromMemberId: 1, toMemberId: 2, amount: 3000 }),
    ).not.toThrow();
  });

  it.each([0, -5, 12.5])('refuses an amount of %s', (amount) => {
    expect(() =>
      assertValidSettlement({ fromMemberId: 1, toMemberId: 2, amount }),
    ).toThrow(InvalidSettlement);
  });

  it('refuses a member repaying themselves', () => {
    expect(() =>
      assertValidSettlement({ fromMemberId: 1, toMemberId: 1, amount: 100 }),
    ).toThrow(InvalidSettlement);
  });
});

describe('assertInvolved', () => {
  const settlement = { fromMemberId: 1, toMemberId: 2 };

  it('lets the member who paid act', () => {
    expect(() => assertInvolved(settlement, 1)).not.toThrow();
  });

  it('lets the member who was paid act', () => {
    expect(() => assertInvolved(settlement, 2)).not.toThrow();
  });

  it('refuses any other member', () => {
    expect(() => assertInvolved(settlement, 3)).toThrow(
      NotInvolvedInSettlement,
    );
  });
});

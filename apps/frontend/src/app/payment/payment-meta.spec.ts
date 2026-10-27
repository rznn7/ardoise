import { type GroupMember } from '@ardoise/shared';
import { describe, expect, it } from 'vitest';

import { paymentMeta } from './payment-meta';

const members: readonly GroupMember[] = [
  { id: 11, userId: 1, name: 'Gabriel', nickname: null, isModerator: true },
  { id: 12, userId: 2, name: 'Léa', nickname: null, isModerator: false },
];

const payment = {
  payerMemberId: 12,
  paidAt: new Date(2026, 9, 25, 12).toISOString(),
  splitType: 'equal' as const,
};

describe('paymentMeta', () => {
  it('says who paid, when, and how it is split', () => {
    expect(paymentMeta(payment, members, 1)).toBe('Paid by Léa · Sun 25 Oct · Equally');
  });

  it('says you when the current user paid', () => {
    expect(paymentMeta({ ...payment, payerMemberId: 11 }, members, 1)).toBe(
      'Paid by you · Sun 25 Oct · Equally',
    );
  });

  it('says someone when the payer is not a member any more', () => {
    expect(paymentMeta({ ...payment, payerMemberId: 99 }, members, 1)).toBe(
      'Paid by someone · Sun 25 Oct · Equally',
    );
  });

  it.each([
    ['shares', 'By shares'],
    ['percent', 'By percentage'],
    ['exact', 'Exact amounts'],
  ] as const)('labels a %s split as %s', (splitType, label) => {
    expect(paymentMeta({ ...payment, splitType }, members, 1)).toBe(
      `Paid by Léa · Sun 25 Oct · ${label}`,
    );
  });
});

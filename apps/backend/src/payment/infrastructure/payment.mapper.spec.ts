import { describe, expect, it } from 'vitest';

import { toPaymentResponse } from './payment.mapper';

describe('toPaymentResponse', () => {
  it('maps a domain payment to its response contract, dates as ISO strings', () => {
    expect(
      toPaymentResponse({
        id: 1,
        payerMemberId: 2,
        groupId: 3,
        title: 'Dinner',
        paidAt: new Date('2026-03-01T12:00:00.000Z'),
        fullAmount: 4200,
        splitType: 'equal',
        createdAt: new Date('2026-03-01T12:30:00.000Z'),
      }),
    ).toEqual({
      id: 1,
      payerMemberId: 2,
      groupId: 3,
      title: 'Dinner',
      paidAt: '2026-03-01T12:00:00.000Z',
      fullAmount: 4200,
      splitType: 'equal',
      createdAt: '2026-03-01T12:30:00.000Z',
    });
  });
});

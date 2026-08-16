import { describe, expect, it } from 'vitest';

import { toExpenseGroupSummary } from './expense-group.mapper';

describe('toExpenseGroupSummary', () => {
  it('maps a domain expense group to its summary contract', () => {
    const createdAt = new Date('2026-01-02T03:04:05.000Z');

    expect(
      toExpenseGroupSummary({
        id: 7,
        name: 'Holidays',
        currencyCode: 'EUR',
        createdAt,
      }),
    ).toEqual({
      id: 7,
      name: 'Holidays',
      currencyCode: 'EUR',
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });
});

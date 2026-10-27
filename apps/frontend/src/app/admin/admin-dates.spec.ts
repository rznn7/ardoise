import { describe, expect, it } from 'vitest';

import { expiresIn, groupMeta, groupsLabel, signedInLabel } from './admin-dates';

const NOW = new Date(2026, 9, 27, 15);
const at = (daysAgo: number): string => new Date(2026, 9, 27 - daysAgo, 10).toISOString();

describe('signedInLabel', () => {
  it('says today', () => {
    expect(signedInLabel(at(0), at(30), NOW)).toBe('signed in today');
  });

  it('says yesterday', () => {
    expect(signedInLabel(at(1), at(30), NOW)).toBe('signed in yesterday');
  });

  it('counts days within a week', () => {
    expect(signedInLabel(at(2), at(30), NOW)).toBe('signed in 2 days ago');
  });

  it('falls back to the join date without a sign-in', () => {
    expect(signedInLabel(null, at(1), NOW)).toBe('joined yesterday');
  });

  it('uses the date past a week', () => {
    expect(signedInLabel(at(20), at(30), NOW)).toBe('signed in 7 Oct');
  });
});

describe('expiresIn', () => {
  it('counts whole days ahead', () => {
    expect(expiresIn(new Date(2026, 10, 1, 15).toISOString(), NOW)).toBe('expires in 5 days');
  });

  it('says tomorrow', () => {
    expect(expiresIn(new Date(2026, 9, 28, 15).toISOString(), NOW)).toBe('expires tomorrow');
  });

  it('says today', () => {
    expect(expiresIn(new Date(2026, 9, 27, 20).toISOString(), NOW)).toBe('expires today');
  });
});

describe('groupsLabel', () => {
  it('handles none, one and many', () => {
    expect([0, 1, 4].map(groupsLabel)).toEqual(['No group', '1 group', '4 groups']);
  });
});

describe('groupMeta', () => {
  const group = {
    id: 1,
    name: 'Lisbon trip',
    currencyCode: 'EUR',
    createdAt: new Date(2026, 9, 1, 12).toISOString(),
    paymentCount: 31,
    totalSpent: 124000,
  };

  it('gives the currency, creation day, payment count and total spent', () => {
    expect(groupMeta(group)).toBe('EUR · created 1 Oct · 31 payments · €1,240.00 spent');
  });

  it('says 1 payment in the singular', () => {
    expect(groupMeta({ ...group, paymentCount: 1 })).toContain('· 1 payment ·');
  });

  it('spends in the group currency', () => {
    expect(groupMeta({ ...group, currencyCode: 'USD' })).toContain('$1,240.00 spent');
  });
});

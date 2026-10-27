import { type GroupMember } from '@ardoise/shared';
import { describe, expect, it } from 'vitest';

import { involvesMe, settlementLabel } from './settlement-label';

const member = (id: number, userId: number, name: string): GroupMember =>
  ({ id, userId, name, isModerator: false }) as GroupMember;

const members = [member(1, 10, 'Léa'), member(2, 20, 'Tom'), member(3, 30, 'Max')];

describe('settlementLabel', () => {
  it('speaks to me when I paid', () => {
    expect(settlementLabel({ fromMemberId: 3, toMemberId: 1 }, members, 30)).toBe(
      'You paid Léa back',
    );
  });

  it('speaks to me when I was paid', () => {
    expect(settlementLabel({ fromMemberId: 2, toMemberId: 3 }, members, 30)).toBe(
      'Tom paid you back',
    );
  });

  it('names both sides between others', () => {
    expect(settlementLabel({ fromMemberId: 2, toMemberId: 1 }, members, 30)).toBe(
      'Tom paid Léa back',
    );
  });
});

describe('involvesMe', () => {
  it('is true for either side', () => {
    expect(involvesMe({ fromMemberId: 3, toMemberId: 1 }, members, 30)).toBe(true);
    expect(involvesMe({ fromMemberId: 2, toMemberId: 3 }, members, 30)).toBe(true);
  });

  it('is false between others', () => {
    expect(involvesMe({ fromMemberId: 2, toMemberId: 1 }, members, 30)).toBe(false);
  });
});

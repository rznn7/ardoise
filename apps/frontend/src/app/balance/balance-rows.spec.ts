import { type GroupMember } from '@ardoise/shared';

import { memberRows, repaymentRows } from './balance-rows';

const member = (id: number, userId: number, name: string): GroupMember => ({
  id,
  userId,
  name,
  nickname: null,
  isModerator: false,
});

const MEMBERS = [
  member(11, 1, 'Gabriel'),
  member(12, 2, 'Léa'),
  member(13, 3, 'Tom'),
  member(14, 4, 'Max'),
];
const ME = 1;

describe('memberRows', () => {
  it('sorts from most owed to most owing, then by name', () => {
    const rows = memberRows(
      [
        { memberId: 11, amount: -1000 },
        { memberId: 12, amount: 2000 },
        { memberId: 13, amount: -1000 },
        { memberId: 14, amount: 0 },
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => row.name)).toEqual(['Léa', 'Max', 'Tom', 'You']);
  });

  it('names my row You and flags it', () => {
    const [mine] = memberRows([{ memberId: 11, amount: 0 }], MEMBERS, ME);

    expect(mine).toMatchObject({ memberId: 11, name: 'You', isMe: true });
  });

  it('scales ratios to the largest absolute balance', () => {
    const rows = memberRows(
      [
        { memberId: 11, amount: -4000 },
        { memberId: 12, amount: 3000 },
        { memberId: 13, amount: 1000 },
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => row.ratio)).toEqual([0.75, 0.25, -1]);
  });

  it('gives every row a zero ratio when all are settled', () => {
    const rows = memberRows(
      [
        { memberId: 11, amount: 0 },
        { memberId: 12, amount: 0 },
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => row.ratio)).toEqual([0, 0]);
  });
});

describe('repaymentRows', () => {
  it('words each transfer from my point of view', () => {
    const rows = repaymentRows(
      [
        { fromMemberId: 11, toMemberId: 12, amount: 3000 },
        { fromMemberId: 13, toMemberId: 11, amount: 1200 },
        { fromMemberId: 13, toMemberId: 12, amount: 5820 },
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => row.label)).toEqual(['You pay Léa', 'Tom pays you', 'Tom pays Léa']);
  });

  it('puts my repayments first, then the largest amounts', () => {
    const rows = repaymentRows(
      [
        { fromMemberId: 13, toMemberId: 12, amount: 5820 },
        { fromMemberId: 11, toMemberId: 14, amount: 1250 },
        { fromMemberId: 14, toMemberId: 12, amount: 9000 },
        { fromMemberId: 11, toMemberId: 12, amount: 3000 },
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => [row.label, row.mine])).toEqual([
      ['You pay Léa', true],
      ['You pay Max', true],
      ['Max pays Léa', false],
      ['Tom pays Léa', false],
    ]);
  });
});

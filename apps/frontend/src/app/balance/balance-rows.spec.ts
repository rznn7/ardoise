import { type GroupMember, type SettlementResponse } from '@ardoise/shared';

import { doneRows, memberRows, repaymentRows } from './balance-rows';

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
      [],
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
      [],
    );

    expect(rows.map((row) => [row.label, row.mine])).toEqual([
      ['You pay Léa', true],
      ['You pay Max', true],
      ['Max pays Léa', false],
      ['Tom pays Léa', false],
    ]);
  });

  it('words the confirm button for the side I am on', () => {
    const rows = repaymentRows(
      [
        { fromMemberId: 11, toMemberId: 12, amount: 3000 },
        { fromMemberId: 13, toMemberId: 11, amount: 1200 },
        { fromMemberId: 13, toMemberId: 12, amount: 5820 },
      ],
      MEMBERS,
      ME,
      [],
    );

    expect(rows.map((row) => row.confirmLabel)).toEqual([
      'I paid Léa back',
      'Tom paid me back',
      null,
    ]);
  });

  it('flags a repayment whose record is still saving', () => {
    const rows = repaymentRows(
      [
        { fromMemberId: 11, toMemberId: 12, amount: 3000 },
        { fromMemberId: 11, toMemberId: 14, amount: 1250 },
      ],
      MEMBERS,
      ME,
      [{ groupId: 7, fromMemberId: 11, toMemberId: 12, amount: 3000 }],
    );

    expect(rows.map((row) => [row.label, row.pending])).toEqual([
      ['You pay Léa', true],
      ['You pay Max', false],
    ]);
  });
});

describe('doneRows', () => {
  const settlement = (
    id: number,
    fromMemberId: number,
    toMemberId: number,
    settledAt: string,
  ): SettlementResponse => ({
    id,
    groupId: 7,
    fromMemberId,
    toMemberId,
    amount: 1000 * id,
    settledAt,
    createdByMemberId: fromMemberId,
    createdAt: settledAt,
  });

  it('lists repayments newest first, mine flagged', () => {
    const rows = doneRows(
      [
        settlement(1, 11, 12, '2026-10-20T10:00:00.000Z'),
        settlement(2, 14, 12, '2026-10-25T10:00:00.000Z'),
        settlement(3, 13, 11, '2026-10-22T10:00:00.000Z'),
      ],
      MEMBERS,
      ME,
    );

    expect(rows.map((row) => [row.id, row.label, row.amount, row.mine])).toEqual([
      [2, 'Max paid Léa back', 2000, false],
      [3, 'Tom paid you back', 3000, true],
      [1, 'You paid Léa back', 1000, true],
    ]);
  });
});

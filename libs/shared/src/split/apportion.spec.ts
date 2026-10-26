import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { apportion, type Weighted } from './apportion.js';

describe('apportion', () => {
  it('divides cleanly when there is no remainder', () => {
    expect(
      apportion(
        900,
        [
          { memberId: 1, weight: 1 },
          { memberId: 2, weight: 1 },
          { memberId: 3, weight: 1 },
        ],
        1,
      ),
    ).toEqual([
      { memberId: 1, amount: 300 },
      { memberId: 2, amount: 300 },
      { memberId: 3, amount: 300 },
    ]);
  });

  it('gives the payer the first extra cent when every remainder ties', () => {
    expect(
      apportion(
        1001,
        [
          { memberId: 1, weight: 1 },
          { memberId: 2, weight: 1 },
          { memberId: 3, weight: 1 },
        ],
        2,
      ),
    ).toEqual([
      { memberId: 1, amount: 334 },
      { memberId: 2, amount: 334 },
      { memberId: 3, amount: 333 },
    ]);
  });

  it('lets the largest remainder win over the payer preference', () => {
    expect(
      apportion(
        1000,
        [
          { memberId: 1, weight: 1 },
          { memberId: 2, weight: 2 },
          { memberId: 3, weight: 3 },
        ],
        3,
      ),
    ).toEqual([
      { memberId: 1, amount: 167 },
      { memberId: 2, amount: 333 },
      { memberId: 3, amount: 500 },
    ]);
  });

  it('falls back to lowest memberId when the payer is not a participant', () => {
    expect(
      apportion(
        1001,
        [
          { memberId: 5, weight: 1 },
          { memberId: 7, weight: 1 },
        ],
        9,
      ),
    ).toEqual([
      { memberId: 5, amount: 501 },
      { memberId: 7, amount: 500 },
    ]);
  });

  it('gives a zero-weight participant exactly zero', () => {
    expect(
      apportion(
        1001,
        [
          { memberId: 1, weight: 0 },
          { memberId: 2, weight: 1 },
          { memberId: 3, weight: 1 },
        ],
        1,
      ),
    ).toEqual([
      { memberId: 1, amount: 0 },
      { memberId: 2, amount: 501 },
      { memberId: 3, amount: 500 },
    ]);
  });

  it('preserves input order regardless of who wins the extra cents', () => {
    expect(
      apportion(
        1001,
        [
          { memberId: 3, weight: 1 },
          { memberId: 1, weight: 1 },
          { memberId: 2, weight: 1 },
        ],
        2,
      ),
    ).toEqual([
      { memberId: 3, amount: 333 },
      { memberId: 1, amount: 334 },
      { memberId: 2, amount: 334 },
    ]);
  });
});

const NON_PARTICIPANT = 1_000;
const MAX_PARTICIPANTS = 12;

const participants = (weight: fc.Arbitrary<number>) =>
  fc.uniqueArray(
    fc.record({ memberId: fc.integer({ min: 1, max: 999 }), weight }),
    {
      minLength: 1,
      maxLength: MAX_PARTICIPANTS,
      selector: (participant) => participant.memberId,
    },
  );

const allRemaindersTied = participants(fc.constant(1));
const remaindersOftenTied = participants(fc.nat({ max: 4 }));
const remaindersRarelyTied = participants(fc.nat({ max: 1_000_000 }));

const splitInput = fc
  .oneof(allRemaindersTied, remaindersOftenTied, remaindersRarelyTied)
  .filter((weights) => weights.some((w) => w.weight > 0))
  .chain((weights) =>
    fc.record({
      fullAmount: fc.integer({ min: 1, max: 10_000_000 }),
      weights: fc.constant(weights),
      payerMemberId: fc.oneof(
        fc.constantFrom(...weights.map((w) => w.memberId)),
        fc.constant(NON_PARTICIPANT),
      ),
    }),
  );

type SplitInput = {
  fullAmount: number;
  weights: readonly Weighted[];
  payerMemberId: number;
};

const shares = ({ fullAmount, weights, payerMemberId }: SplitInput) => {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  const amounts = new Map(
    apportion(fullAmount, weights, payerMemberId).map((r) => [
      r.memberId,
      r.amount,
    ]),
  );
  return weights.map((w) => ({
    memberId: w.memberId,
    weight: w.weight,
    floor: Math.floor((fullAmount * w.weight) / totalWeight),
    remainder: (fullAmount * w.weight) % totalWeight,
    amount: amounts.get(w.memberId) ?? Number.NaN,
  }));
};

const wonACent = (share: { amount: number; floor: number }) =>
  share.amount === share.floor + 1;

describe('apportion — properties', () => {
  it('always distributes exactly fullAmount', () => {
    fc.assert(
      fc.property(splitInput, (input) => {
        const total = shares(input).reduce((sum, s) => sum + s.amount, 0);
        expect(total).toBe(input.fullAmount);
      }),
      { numRuns: 500 },
    );
  });

  it('never moves a share more than one cent from its exact floor', () => {
    fc.assert(
      fc.property(splitInput, (input) => {
        shares(input).forEach((share) => {
          expect(share.amount).toBeGreaterThanOrEqual(share.floor);
          expect(share.amount).toBeLessThanOrEqual(share.floor + 1);
        });
      }),
    );
  });

  it('never gives a cent to a zero-weight participant', () => {
    fc.assert(
      fc.property(splitInput, (input) => {
        shares(input)
          .filter((share) => share.weight === 0)
          .forEach((share) => {
            expect(share.amount).toBe(0);
          });
      }),
    );
  });

  it('returns shares in the order the participants were given', () => {
    fc.assert(
      fc.property(splitInput, ({ fullAmount, weights, payerMemberId }) => {
        expect(
          apportion(fullAmount, weights, payerMemberId).map((r) => r.memberId),
        ).toEqual(weights.map((w) => w.memberId));
      }),
    );
  });

  it('never lets a loser out-remainder a winner', () => {
    fc.assert(
      fc.property(splitInput, (input) => {
        const all = shares(input);
        const winners = all.filter(wonACent).map((s) => s.remainder);
        const losers = all
          .filter((share) => !wonACent(share))
          .map((s) => s.remainder);
        if (winners.length === 0 || losers.length === 0) return;

        expect(Math.min(...winners)).toBeGreaterThanOrEqual(
          Math.max(...losers),
        );
      }),
    );
  });

  it('gives the payer a cent whenever a winner ties their remainder', () => {
    fc.assert(
      fc.property(splitInput, (input) => {
        const all = shares(input);
        const payer = all.find(
          (share) => share.memberId === input.payerMemberId,
        );
        if (!payer) return;

        const winners = all.filter(wonACent).map((s) => s.remainder);
        if (!winners.includes(payer.remainder)) return;

        expect(wonACent(payer)).toBe(true);
      }),
    );
  });
});

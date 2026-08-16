import { describe, expect, it } from 'vitest';

import {
  computePaymentShares,
  type ComputeSharesInput,
  InvalidSplit,
  type InvalidSplitCode,
  MAX_SHARE_WEIGHT,
} from './compute-payment-shares';

describe('computePaymentShares', () => {
  it('splits EQUAL evenly and normalizes inputValue to zero', () => {
    expect(
      computePaymentShares({
        fullAmount: 1001,
        splitType: 'equal',
        payerMemberId: 2,
        participants: [
          { memberId: 1, inputValue: 999 },
          { memberId: 2, inputValue: 0 },
          { memberId: 3, inputValue: 7 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 0, amount: 334 },
      { memberId: 2, inputValue: 0, amount: 334 },
      { memberId: 3, inputValue: 0, amount: 333 },
    ]);
  });

  it('splits SHARES by weight and echoes inputValue', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'shares',
        payerMemberId: 3,
        participants: [
          { memberId: 1, inputValue: 1 },
          { memberId: 2, inputValue: 2 },
          { memberId: 3, inputValue: 3 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 1, amount: 167 },
      { memberId: 2, inputValue: 2, amount: 333 },
      { memberId: 3, inputValue: 3, amount: 500 },
    ]);
  });

  it('splits PERCENT by basis points and echoes inputValue', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'percent',
        payerMemberId: 1,
        participants: [
          { memberId: 1, inputValue: 3333 },
          { memberId: 2, inputValue: 3333 },
          { memberId: 3, inputValue: 3334 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 3333, amount: 333 },
      { memberId: 2, inputValue: 3333, amount: 333 },
      { memberId: 3, inputValue: 3334, amount: 334 },
    ]);
  });

  it('passes EXACT cents straight through', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'exact',
        payerMemberId: 1,
        participants: [
          { memberId: 1, inputValue: 250 },
          { memberId: 2, inputValue: 250 },
          { memberId: 3, inputValue: 500 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 250, amount: 250 },
      { memberId: 2, inputValue: 250, amount: 250 },
      { memberId: 3, inputValue: 500, amount: 500 },
    ]);
  });

  it('splits normally when the payer is not a participant', () => {
    const shares = computePaymentShares({
      fullAmount: 1001,
      splitType: 'equal',
      payerMemberId: 99,
      participants: [
        { memberId: 5, inputValue: 0 },
        { memberId: 7, inputValue: 0 },
      ],
    });

    expect(shares).toEqual([
      { memberId: 5, inputValue: 0, amount: 501 },
      { memberId: 7, inputValue: 0, amount: 500 },
    ]);
  });

  it('always produces shares summing to fullAmount', () => {
    const shares = computePaymentShares({
      fullAmount: 997,
      splitType: 'shares',
      payerMemberId: 1,
      participants: [
        { memberId: 1, inputValue: 5 },
        { memberId: 2, inputValue: 3 },
        { memberId: 3, inputValue: 1 },
      ],
    });

    expect(shares.reduce((sum, s) => sum + s.amount, 0)).toBe(997);
  });

  it('ignores a negative inputValue for EQUAL, where it is unused', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'equal',
        payerMemberId: 1,
        participants: [
          { memberId: 1, inputValue: -1 },
          { memberId: 2, inputValue: -9 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 0, amount: 500 },
      { memberId: 2, inputValue: 0, amount: 500 },
    ]);
  });

  it('gives a single participant the entire fullAmount', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'shares',
        payerMemberId: 1,
        participants: [{ memberId: 1, inputValue: 7 }],
      }),
    ).toEqual([{ memberId: 1, inputValue: 7, amount: 1000 }]);
  });

  it('gives a PERCENT participant holding 0 basis points exactly 0', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'percent',
        payerMemberId: 1,
        participants: [
          { memberId: 1, inputValue: 0 },
          { memberId: 2, inputValue: 10_000 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 0, amount: 0 },
      { memberId: 2, inputValue: 10_000, amount: 1000 },
    ]);
  });

  it('accepts a SHARES weight at exactly MAX_SHARE_WEIGHT with a large fullAmount', () => {
    const fullAmount = 2_000_000_000;
    const shares = computePaymentShares({
      fullAmount,
      splitType: 'shares',
      payerMemberId: 1,
      participants: [
        { memberId: 1, inputValue: MAX_SHARE_WEIGHT },
        { memberId: 2, inputValue: MAX_SHARE_WEIGHT },
        { memberId: 3, inputValue: 1 },
      ],
    });

    expect(shares.reduce((sum, s) => sum + s.amount, 0)).toBe(fullAmount);
  });

  it('holds the sum invariant for a large-magnitude SHARES split near the bound', () => {
    const fullAmount = 2_147_483_647;
    const shares = computePaymentShares({
      fullAmount,
      splitType: 'shares',
      payerMemberId: 2,
      participants: [
        { memberId: 1, inputValue: 852_899 },
        { memberId: 2, inputValue: MAX_SHARE_WEIGHT },
        { memberId: 3, inputValue: 999_999 },
      ],
    });

    expect(shares.reduce((sum, s) => sum + s.amount, 0)).toBe(fullAmount);
  });

  it('gives an EXACT participant at 0 exactly 0', () => {
    expect(
      computePaymentShares({
        fullAmount: 1000,
        splitType: 'exact',
        payerMemberId: 1,
        participants: [
          { memberId: 1, inputValue: 0 },
          { memberId: 2, inputValue: 1000 },
        ],
      }),
    ).toEqual([
      { memberId: 1, inputValue: 0, amount: 0 },
      { memberId: 2, inputValue: 1000, amount: 1000 },
    ]);
  });
});

describe('computePaymentShares — rejected input', () => {
  const valid = {
    fullAmount: 1000,
    splitType: 'shares' as const,
    payerMemberId: 1,
    participants: [
      { memberId: 1, inputValue: 1 },
      { memberId: 2, inputValue: 1 },
    ],
  };

  const expectCode = (input: ComputeSharesInput, code: InvalidSplitCode) => {
    try {
      computePaymentShares(input);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidSplit);
      expect((error as InvalidSplit).code).toBe(code);
      return;
    }
    throw new Error(`expected InvalidSplit(${code}), but nothing was thrown`);
  };

  it('rejects an empty participant set', () => {
    expectCode({ ...valid, participants: [] }, 'EMPTY_PARTICIPANTS');
  });

  it('rejects a non-positive amount', () => {
    expectCode({ ...valid, fullAmount: 0 }, 'NON_POSITIVE_AMOUNT');
    expectCode({ ...valid, fullAmount: -100 }, 'NON_POSITIVE_AMOUNT');
  });

  it('rejects non-integer money', () => {
    expectCode({ ...valid, fullAmount: 10.5 }, 'NON_INTEGER_VALUE');
    expectCode(
      {
        ...valid,
        participants: [
          { memberId: 1, inputValue: 1.5 },
          { memberId: 2, inputValue: 1 },
        ],
      },
      'NON_INTEGER_VALUE',
    );
  });

  it('rejects a duplicated member', () => {
    expectCode(
      {
        ...valid,
        participants: [
          { memberId: 1, inputValue: 1 },
          { memberId: 1, inputValue: 1 },
        ],
      },
      'DUPLICATE_PARTICIPANT',
    );
  });

  it('rejects a negative inputValue', () => {
    expectCode(
      {
        ...valid,
        participants: [
          { memberId: 1, inputValue: -1 },
          { memberId: 2, inputValue: 2 },
        ],
      },
      'NEGATIVE_INPUT_VALUE',
    );
  });

  it('rejects percentages that do not total 10000 basis points', () => {
    expectCode(
      {
        ...valid,
        splitType: 'percent',
        participants: [
          { memberId: 1, inputValue: 5000 },
          { memberId: 2, inputValue: 4000 },
        ],
      },
      'PERCENT_TOTAL_MISMATCH',
    );
  });

  it('rejects exact amounts that do not total fullAmount', () => {
    expectCode(
      {
        ...valid,
        splitType: 'exact',
        participants: [
          { memberId: 1, inputValue: 400 },
          { memberId: 2, inputValue: 500 },
        ],
      },
      'EXACT_TOTAL_MISMATCH',
    );
  });

  it('rejects a SHARES split where every weight is zero', () => {
    expectCode(
      {
        ...valid,
        participants: [
          { memberId: 1, inputValue: 0 },
          { memberId: 2, inputValue: 0 },
        ],
      },
      'ZERO_TOTAL_WEIGHT',
    );
  });

  it('rejects a SHARES weight just over MAX_SHARE_WEIGHT', () => {
    expectCode(
      {
        ...valid,
        participants: [
          { memberId: 1, inputValue: MAX_SHARE_WEIGHT + 1 },
          { memberId: 2, inputValue: 1 },
        ],
      },
      'SHARE_WEIGHT_TOO_LARGE',
    );
  });
});

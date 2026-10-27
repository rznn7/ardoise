import { describe, expect, it } from 'vitest';

import {
  type Cursor,
  decodeCursor,
  encodeCursor,
  InvalidCursor,
  isAfter,
} from './cursor';

const at = (iso: string, rank: 0 | 1, id: number): Cursor => ({
  date: new Date(iso),
  rank,
  id,
});

const encodeRaw = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('cursor encoding', () => {
  it('round-trips through encode and decode', () => {
    const cursor = at('2026-10-27T12:00:00.123Z', 1, 42);

    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    ['not base64 json', '%%%'],
    ['an object', encodeRaw({ date: '2026-10-27T12:00:00.000Z' })],
    ['a short tuple', encodeRaw(['2026-10-27T12:00:00.000Z', 0])],
    ['an invalid date', encodeRaw(['yesterday', 0, 1])],
    ['a rank of 2', encodeRaw(['2026-10-27T12:00:00.000Z', 2, 1])],
    ['an id of 0', encodeRaw(['2026-10-27T12:00:00.000Z', 0, 0])],
    ['a fractional id', encodeRaw(['2026-10-27T12:00:00.000Z', 0, 1.5])],
  ])('refuses %s', (_, raw) => {
    expect(() => decodeCursor(raw)).toThrow(InvalidCursor);
  });
});

describe('isAfter', () => {
  const cursor = at('2026-10-27T12:00:00.000Z', 0, 10);

  it.each([
    ['an older item', at('2026-10-26T12:00:00.000Z', 0, 99), true],
    ['a newer item', at('2026-10-28T12:00:00.000Z', 0, 1), false],
    [
      'a repayment at the same instant',
      at('2026-10-27T12:00:00.000Z', 1, 99),
      true,
    ],
    ['a payment with a lower id', at('2026-10-27T12:00:00.000Z', 0, 9), true],
    ['the same item', at('2026-10-27T12:00:00.000Z', 0, 10), false],
    [
      'a payment with a higher id',
      at('2026-10-27T12:00:00.000Z', 0, 11),
      false,
    ],
  ])('after a payment cursor, %s is %s', (_, item, expected) => {
    expect(isAfter(cursor, item)).toBe(expected);
  });

  it('puts no payment after a repayment cursor at the same instant', () => {
    const repayment = at('2026-10-27T12:00:00.000Z', 1, 10);

    expect(isAfter(repayment, at('2026-10-27T12:00:00.000Z', 0, 1))).toBe(
      false,
    );
    expect(isAfter(repayment, at('2026-10-27T12:00:00.000Z', 1, 9))).toBe(true);
  });
});

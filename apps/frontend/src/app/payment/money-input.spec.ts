import { describe, expect, it } from 'vitest';

import {
  defaultTitle,
  formatAmountInput,
  formatPercentInput,
  parseAmount,
  parsePercent,
  parseShareAmount,
} from './money-input';

describe('parseAmount', () => {
  it.each([
    ['24,5', 2450],
    ['24.50', 2450],
    [',5', 50],
    ['24', 2400],
  ])('reads %s as %d cents', (text, cents) => {
    expect(parseAmount(text)).toBe(cents);
  });

  it.each(['1 240,00', '0', '1.234', 'abc', '', '21474836.48', '-3'])('rejects %s', (text) => {
    expect(parseAmount(text)).toBeNull();
  });

  it('accepts the largest amount', () => {
    expect(parseAmount('21474836.47')).toBe(2_147_483_647);
  });
});

describe('parseShareAmount', () => {
  it('treats empty text as zero', () => {
    expect(parseShareAmount('')).toBe(0);
  });

  it('accepts zero and decimals', () => {
    expect(parseShareAmount('0')).toBe(0);
    expect(parseShareAmount('18,50')).toBe(1850);
  });

  it('rejects garbage', () => {
    expect(parseShareAmount('x')).toBeNull();
  });
});

describe('parsePercent', () => {
  it('reads basis points', () => {
    expect(parsePercent('33,33')).toBe(3333);
    expect(parsePercent('100')).toBe(10000);
    expect(parsePercent('0')).toBe(0);
  });

  it('rejects above 100 and extra decimals', () => {
    expect(parsePercent('100,01')).toBeNull();
    expect(parsePercent('1,234')).toBeNull();
  });

  it('treats empty text as zero', () => {
    expect(parsePercent('')).toBe(0);
  });
});

describe('formatting', () => {
  it('formats cents for an input', () => {
    expect(formatAmountInput(2450)).toBe('24,50');
    expect(formatAmountInput(5)).toBe('0,05');
  });

  it('formats basis points for an input', () => {
    expect(formatPercentInput(5000)).toBe('50');
    expect(formatPercentInput(3333)).toBe('33,33');
    expect(formatPercentInput(1050)).toBe('10,5');
  });

  it('builds the default title', () => {
    expect(defaultTitle(new Date(2026, 9, 26))).toBe('Payment, 26 Oct');
  });
});

import { translatorFor } from 'src/test-providers';
import { describe, expect, it } from 'vitest';

import {
  cashRegisterText,
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
  it('formats cents for an English input with a point', () => {
    expect(formatAmountInput(2450, 'en-GB')).toBe('24.50');
    expect(formatAmountInput(5, 'en-GB')).toBe('0.05');
  });

  it('formats cents for a French input with a comma and no grouping', () => {
    expect(formatAmountInput(2450, 'fr-FR')).toBe('24,50');
    expect(formatAmountInput(123456, 'fr-FR')).toBe('1234,56');
    expect(formatAmountInput(123456, 'en-GB')).toBe('1234.56');
  });

  it('reads back what it formats in either language', () => {
    expect(parseAmount(formatAmountInput(2450, 'en-GB'))).toBe(2450);
    expect(parseAmount(formatAmountInput(2450, 'fr-FR'))).toBe(2450);
    expect(parsePercent(formatPercentInput(1050, 'fr-FR'))).toBe(1050);
  });

  it('formats basis points for an input', () => {
    expect(formatPercentInput(5000, 'en-GB')).toBe('50');
    expect(formatPercentInput(3333, 'en-GB')).toBe('33.33');
    expect(formatPercentInput(1050, 'en-GB')).toBe('10.5');
    expect(formatPercentInput(1050, 'fr-FR')).toBe('10,5');
  });

  it('builds the default title in the creator language', () => {
    expect(defaultTitle(new Date(2026, 9, 26), translatorFor('en'))).toBe('Payment, 26 Oct');
    expect(defaultTitle(new Date(2026, 10, 3), translatorFor('fr'))).toBe('Paiement, 3 nov.');
  });
});

describe('cashRegisterText', () => {
  it.each([
    ['1', '', '0.01'],
    ['0.012', '0.01', '0.12'],
    ['0.123', '0.12', '1.23'],
    ['1.230', '1.23', '12.30'],
    ['1.2', '1.23', '0.12'],
    ['0.0', '0.01', ''],
    ['0', '', ''],
    ['abc', '', ''],
    ['', '0.01', ''],
    ['1.23,', '1.23', '1.23'],
    ['1.23a', '1.23', '1.23'],
    ['24,50', '', '24.50'],
    ['24,5', '', '2.45'],
    ['12.503', '12.50', '125.03'],
  ])('turns %j (was %j) into %j', (typed, previous, expected) => {
    expect(cashRegisterText(typed, previous, 'en')).toBe(expected);
  });

  it('writes a French comma', () => {
    expect(cashRegisterText('0,123', '0,12', 'fr')).toBe('1,23');
  });

  it('accepts the largest amount and refuses one digit more', () => {
    expect(cashRegisterText('2147483647', '', 'en')).toBe('21474836.47');
    expect(cashRegisterText('21474836.479', '21474836.47', 'en')).toBe('21474836.47');
  });
});

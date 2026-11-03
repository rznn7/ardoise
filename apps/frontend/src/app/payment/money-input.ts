import { marker } from '@jsverse/transloco-keys-manager/marker';
import { dateFormat, numberFormat } from 'src/app/shared/i18n/intl-cache';
import { type Translator } from 'src/app/shared/i18n/translation-key';

const MAX_CENTS = 2_147_483_647;
const MAX_PERCENT_BASIS_POINTS = 10_000;
const DECIMAL_PATTERN = /^(\d*)(?:[.,](\d{0,2}))?$/;

const parseDecimal = (text: string): number | null => {
  const match = DECIMAL_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  return Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
};

export const parseAmount = (text: string): number | null => {
  const cents = parseDecimal(text);
  return cents !== null && cents > 0 && cents <= MAX_CENTS ? cents : null;
};

export const parseShareAmount = (text: string): number | null => {
  if (text.trim() === '') return 0;
  const cents = parseDecimal(text);
  return cents !== null && cents <= MAX_CENTS ? cents : null;
};

export const parsePercent = (text: string): number | null => {
  if (text.trim() === '') return 0;
  const basisPoints = parseDecimal(text);
  return basisPoints !== null && basisPoints <= MAX_PERCENT_BASIS_POINTS ? basisPoints : null;
};

const decimalSeparator = (locale: string): string =>
  numberFormat(locale, {})
    .formatToParts(1.1)
    .find(({ type }) => type === 'decimal')?.value ?? '.';

export const formatAmountInput = (cents: number, locale: string): string => {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${String(whole)}${decimalSeparator(locale)}${fraction}`;
};

export const formatPercentInput = (basisPoints: number, locale: string): string => {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${String(whole)}${decimalSeparator(locale)}${fraction}`;
};

const TITLE_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

export const defaultTitle = (date: Date, tr: Translator): string =>
  tr.translate(marker('payment.defaultTitle'), {
    date: dateFormat(tr.locale, TITLE_DAY).format(date),
  });

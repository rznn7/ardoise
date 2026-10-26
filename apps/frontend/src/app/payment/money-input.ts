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

export const formatAmountInput = (cents: number): string => {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, '0');
  return `${String(whole)},${fraction}`;
};

export const formatPercentInput = (basisPoints: number): string => {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100)
    .padStart(2, '0')
    .replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${String(whole)},${fraction}`;
};

const titleDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export const defaultTitle = (date: Date): string => `Payment, ${titleDateFormat.format(date)}`;

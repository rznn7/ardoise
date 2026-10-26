import { dayLabel } from './day-label';

describe('dayLabel', () => {
  const today = new Date(2026, 9, 26, 9, 30);

  it('labels the same calendar day as Today', () => {
    expect(dayLabel(new Date(2026, 9, 26, 23, 59), today)).toBe('Today');
  });

  it('labels the previous calendar day as Yesterday', () => {
    expect(dayLabel(new Date(2026, 9, 25, 0, 1), today)).toBe('Yesterday');
  });

  it('labels older days with weekday, day and short month', () => {
    expect(dayLabel(new Date(2026, 9, 24, 12), today)).toBe('Sat 24 Oct');
  });

  it('labels yesterday across a month boundary', () => {
    expect(dayLabel(new Date(2026, 9, 31, 12), new Date(2026, 10, 1, 8))).toBe('Yesterday');
  });
});

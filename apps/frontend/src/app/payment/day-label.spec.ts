import { translatorFor } from 'src/test-providers';

import { dayLabel, shortDay } from './day-label';

const en = () => translatorFor('en');
const fr = () => translatorFor('fr');

describe('dayLabel', () => {
  const today = new Date(2026, 9, 26, 9, 30);

  it('labels the same calendar day as Today', () => {
    expect(dayLabel(new Date(2026, 9, 26, 23, 59), today, en())).toBe('Today');
  });

  it('labels the previous calendar day as Yesterday', () => {
    expect(dayLabel(new Date(2026, 9, 25, 0, 1), today, en())).toBe('Yesterday');
  });

  it('labels older days with weekday, day and short month', () => {
    expect(dayLabel(new Date(2026, 9, 24, 12), today, en())).toBe('Sat 24 Oct');
  });

  it('speaks French', () => {
    expect(dayLabel(new Date(2026, 9, 26, 12), today, fr())).toBe('Aujourd’hui');
    expect(dayLabel(new Date(2026, 9, 25, 12), today, fr())).toBe('Hier');
    expect(dayLabel(new Date(2026, 9, 24, 12), today, fr())).toBe('sam. 24 oct.');
  });

  it('labels yesterday across a month boundary', () => {
    expect(dayLabel(new Date(2026, 9, 31, 12), new Date(2026, 10, 1, 8), en())).toBe('Yesterday');
  });
});

describe('shortDay', () => {
  it('formats a date with weekday, day and short month', () => {
    expect(shortDay(new Date(2026, 9, 25, 12).toISOString(), 'en-GB')).toBe('Sun 25 Oct');
  });

  it('formats the same date the French way', () => {
    expect(shortDay(new Date(2026, 9, 25, 12).toISOString(), 'fr-FR')).toBe('dim. 25 oct.');
  });
});

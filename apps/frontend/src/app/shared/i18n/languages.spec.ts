import { formatLocaleOf, resolveLanguage } from './languages';

describe('resolveLanguage', () => {
  it('picks French from a French regional device language', () => {
    expect(resolveLanguage('system', ['fr-CA', 'en'])).toBe('fr');
  });

  it('picks French when it appears later in the device list', () => {
    expect(resolveLanguage('system', ['de-DE', 'fr'])).toBe('fr');
  });

  it('falls back to English for any other device language', () => {
    expect(resolveLanguage('system', ['de-DE'])).toBe('en');
    expect(resolveLanguage('system', [])).toBe('en');
  });

  it('lets an explicit preference win over the device', () => {
    expect(resolveLanguage('en', ['fr-FR'])).toBe('en');
    expect(resolveLanguage('fr', ['en-US'])).toBe('fr');
  });
});

describe('formatLocaleOf', () => {
  it('formats English the British way and French the French way', () => {
    expect(formatLocaleOf('en')).toBe('en-GB');
    expect(formatLocaleOf('fr')).toBe('fr-FR');
  });
});

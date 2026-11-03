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
  it('formats with the device variant of the active language', () => {
    expect(formatLocaleOf('en', ['en-US', 'fr-FR'])).toBe('en-US');
    expect(formatLocaleOf('fr', ['en-US', 'fr-CH'])).toBe('fr-CH');
  });

  it('falls back to British English and France French without a device variant', () => {
    expect(formatLocaleOf('en', ['fr-FR'])).toBe('en-GB');
    expect(formatLocaleOf('fr', ['en-US'])).toBe('fr-FR');
    expect(formatLocaleOf('fr', [])).toBe('fr-FR');
  });
});

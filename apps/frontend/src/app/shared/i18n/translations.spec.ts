import MessageFormat from '@messageformat/core';
import en from 'src/i18n/en.json';
import fr from 'src/i18n/fr.json';
import { translatorFor } from 'src/test-providers';

import { LANGUAGES } from './languages';

interface Tree {
  readonly [key: string]: string | Tree;
}

const leaves = (tree: Tree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`),
  );

const files: Readonly<Record<string, Tree>> = { en, fr };

describe('translation files', () => {
  for (const { code, formatLocale } of LANGUAGES) {
    it(`compiles every ${code} message as ICU`, () => {
      const formatter = new MessageFormat(formatLocale);
      const file = files[code];
      if (file === undefined) throw new Error(`No file for ${code}`);
      for (const [key, message] of leaves(file)) {
        expect(() => formatter.compile(message), key).not.toThrow();
      }
    });
  }

  for (const { code } of LANGUAGES) {
    it(`never puts an escaping apostrophe next to a brace in ${code}`, () => {
      const file = files[code];
      if (file === undefined) throw new Error(`No file for ${code}`);
      for (const [key, message] of leaves(file)) {
        expect(message, key).not.toMatch(/'[{}#]|[{}]'/);
      }
    });
  }

  it('translates through the real French file', () => {
    expect(translatorFor('fr').translate('settings.title')).toBe('Réglages');
    expect(translatorFor('fr').locale).toBe('fr-FR');
  });
});

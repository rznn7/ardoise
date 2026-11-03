import { importProvidersFrom } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslocoMissingHandler,
  TranslocoService,
  TranslocoTestingModule,
} from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { formatLocaleOf, type Language } from 'src/app/shared/i18n/languages';
import { AVAILABLE_LANGS } from 'src/app/shared/i18n/provide-i18n';
import { StrictMissingHandler } from 'src/app/shared/i18n/strict-missing-handler';
import { type Translator } from 'src/app/shared/i18n/translation-key';
import en from 'src/i18n/en.json';
import fr from 'src/i18n/fr.json';

export default [
  importProvidersFrom(
    TranslocoTestingModule.forRoot({
      langs: { en, fr },
      preloadLangs: true,
      translocoConfig: { availableLangs: AVAILABLE_LANGS, defaultLang: 'en' },
    }),
  ),
  provideTranslocoMessageformat(),
  provideTranslocoMissingHandler(StrictMissingHandler),
];

export function translatorFor(language: Language): Translator {
  const transloco = TestBed.inject(TranslocoService);
  return {
    locale: formatLocaleOf(language),
    translate: (key, params) => {
      transloco.setActiveLang(language);
      return transloco.translate(key, params, language);
    },
  };
}

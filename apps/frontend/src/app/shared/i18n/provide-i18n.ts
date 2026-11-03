import { type EnvironmentProviders, isDevMode } from '@angular/core';
import { provideTransloco, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';

import { DEFAULT_LANGUAGE, LANGUAGES } from './languages';
import { StrictMissingHandler } from './strict-missing-handler';
import { JsonTranslationLoader } from './transloco-loader';

export const AVAILABLE_LANGS = LANGUAGES.map(({ code }) => code);

export function provideI18n(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: AVAILABLE_LANGS,
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: { useFallbackTranslation: true, logMissingKey: false },
      },
      loader: JsonTranslationLoader,
    }),
    provideTranslocoMessageformat(),
    provideTranslocoMissingHandler(StrictMissingHandler),
  ];
}

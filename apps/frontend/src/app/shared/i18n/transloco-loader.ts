import { Injectable } from '@angular/core';
import { type Translation, type TranslocoLoader } from '@jsverse/transloco';

const files: Readonly<Record<string, () => Promise<{ default: Translation }>>> = {
  en: () => import('src/i18n/en.json'),
  fr: () => import('src/i18n/fr.json'),
};

@Injectable({ providedIn: 'root' })
export class JsonTranslationLoader implements TranslocoLoader {
  async getTranslation(lang: string): Promise<Translation> {
    const load = files[lang];
    if (load === undefined) throw new Error(`No translations for ${lang}`);
    return (await load()).default;
  }
}

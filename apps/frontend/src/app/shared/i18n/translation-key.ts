import type en from 'src/i18n/en.json';

export type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export type TranslationKey = LeafPaths<typeof en>;
export type TranslationParams = Readonly<Record<string, string | number>>;
export type Translate = (key: TranslationKey, params?: TranslationParams) => string;

export interface Translator {
  readonly translate: Translate;
  readonly locale: string;
}

export type Language = 'en' | 'fr';
export type LanguagePreference = 'system' | Language;

export interface LanguageOption {
  readonly code: Language;
  readonly nativeName: string;
  readonly formatLocale: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', nativeName: 'English', formatLocale: 'en-GB' },
  { code: 'fr', nativeName: 'Français', formatLocale: 'fr-FR' },
];

export const DEFAULT_LANGUAGE: Language = 'en';

const primarySubtag = (tag: string): string => tag.split('-')[0]?.toLowerCase() ?? '';

const deviceLanguage = (deviceLanguages: readonly string[]): Language => {
  const match = deviceLanguages
    .map(primarySubtag)
    .find((subtag) => LANGUAGES.some(({ code }) => code === subtag && code !== DEFAULT_LANGUAGE));
  return LANGUAGES.find(({ code }) => code === match)?.code ?? DEFAULT_LANGUAGE;
};

export const resolveLanguage = (
  preference: LanguagePreference,
  deviceLanguages: readonly string[],
): Language => (preference === 'system' ? deviceLanguage(deviceLanguages) : preference);

export const formatLocaleOf = (language: Language, deviceLanguages: readonly string[]): string =>
  deviceLanguages.find((tag) => primarySubtag(tag) === language) ??
  LANGUAGES.find(({ code }) => code === language)?.formatLocale ??
  'en-GB';

export const isLanguagePreference = (value: unknown): value is LanguagePreference =>
  value === 'system' || LANGUAGES.some(({ code }) => code === value);

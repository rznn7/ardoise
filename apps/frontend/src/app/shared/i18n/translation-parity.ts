import type en from 'src/i18n/en.json';
import type fr from 'src/i18n/fr.json';

import type { LeafPaths } from './translation-key';

type MissingIn<Reference, Other> = Exclude<LeafPaths<Reference>, LeafPaths<Other>>;

type AssertNever<T extends never> = T;

export type FrenchHasEveryEnglishKey = AssertNever<MissingIn<typeof en, typeof fr>>;
export type FrenchHasNoExtraKey = AssertNever<MissingIn<typeof fr, typeof en>>;

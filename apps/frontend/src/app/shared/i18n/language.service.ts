import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import {
  formatLocaleOf,
  isLanguagePreference,
  type Language,
  type LanguagePreference,
  resolveLanguage,
} from './languages';
import { type Translator } from './translation-key';

export const LANGUAGE_STORAGE_KEY = 'ardoise.language';

function readStoredPreference(): LanguagePreference {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredPreference(preference: LanguagePreference): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly deviceLanguages = signal<readonly string[]>(navigator.languages);
  private readonly preferenceState = signal<LanguagePreference>(readStoredPreference());
  private readonly activeState = signal<Language>(this.wanted());
  private pending: Promise<void>;

  readonly preference = this.preferenceState.asReadonly();
  readonly active = this.activeState.asReadonly();

  readonly translator = computed<Translator>(() => {
    const language = this.activeState();
    return {
      locale: formatLocaleOf(language, this.deviceLanguages()),
      translate: (key, params) => this.transloco.translate(key, params, language),
    };
  });

  constructor() {
    this.pending = this.apply();
    window.addEventListener('languagechange', () => {
      this.deviceLanguages.set(navigator.languages);
      if (this.preferenceState() === 'system') this.pending = this.apply();
    });
  }

  ready(): Promise<void> {
    return this.pending;
  }

  setPreference(preference: LanguagePreference): Promise<void> {
    this.preferenceState.set(preference);
    writeStoredPreference(preference);
    this.pending = this.apply();
    return this.pending;
  }

  private wanted(): Language {
    return resolveLanguage(this.preferenceState(), this.deviceLanguages());
  }

  private async apply(): Promise<void> {
    const language = this.wanted();
    await firstValueFrom(this.transloco.load(language), { defaultValue: undefined });
    if (language !== this.wanted()) return;
    this.transloco.setActiveLang(language);
    this.activeState.set(language);
    this.document.documentElement.lang = language;
  }
}

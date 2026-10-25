import { computed, DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ardoise.theme';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writeStoredPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.systemQuery.matches);
  private readonly preferenceState = signal<ThemePreference>(readStoredPreference());

  readonly preference = this.preferenceState.asReadonly();

  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preferenceState();
    if (preference !== 'system') return preference;
    return this.systemDark() ? 'dark' : 'light';
  });

  constructor() {
    this.systemQuery.addEventListener('change', () => {
      this.systemDark.set(this.systemQuery.matches);
    });
    effect(() => {
      this.document.documentElement.classList.toggle('dark', this.resolved() === 'dark');
    });
  }

  setPreference(preference: ThemePreference): void {
    this.preferenceState.set(preference);
    writeStoredPreference(preference);
  }
}

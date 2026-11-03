import { computed, inject, Injectable, signal } from '@angular/core';
import { dateFormat } from 'src/app/shared/i18n/intl-cache';
import { LanguageService } from 'src/app/shared/i18n/language.service';
import { type Translator } from 'src/app/shared/i18n/translation-key';

import { VERSION_URL } from './version-watcher';

const SHORT_SHA_LENGTH = 7;
const COMMIT_DAY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

export function versionLabel(body: unknown, tr: Translator): string {
  const dev = tr.translate('settings.version.dev');
  if (typeof body !== 'object' || body === null) return dev;
  const sha = 'sha' in body ? body.sha : undefined;
  const date = 'date' in body ? body.date : undefined;
  if (typeof sha !== 'string' || sha === 'dev' || typeof date !== 'string') return dev;
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) return dev;
  return tr.translate('settings.version.build', {
    sha: sha.slice(0, SHORT_SHA_LENGTH),
    day: dateFormat(tr.locale, COMMIT_DAY).format(day),
  });
}

async function fetchVersion(): Promise<unknown> {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AppVersion {
  private readonly language = inject(LanguageService);
  private readonly body = signal<unknown>(null);

  readonly label = computed(() => versionLabel(this.body(), this.language.translator()));

  constructor() {
    void fetchVersion().then((body) => {
      this.body.set(body);
    });
  }
}

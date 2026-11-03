import { Injectable, signal } from '@angular/core';

import { VERSION_URL } from './version-watcher';

const DEV_LABEL = 'Version dev';
const SHORT_SHA_LENGTH = 7;

const commitDay = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function versionLabel(body: unknown): string {
  if (typeof body !== 'object' || body === null) return DEV_LABEL;
  const sha = 'sha' in body ? body.sha : undefined;
  const date = 'date' in body ? body.date : undefined;
  if (typeof sha !== 'string' || sha === 'dev' || typeof date !== 'string') return DEV_LABEL;
  const day = new Date(date);
  if (Number.isNaN(day.getTime())) return DEV_LABEL;
  return `Version ${sha.slice(0, SHORT_SHA_LENGTH)} · ${commitDay.format(day)}`;
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
  private readonly labelState = signal(DEV_LABEL);

  readonly label = this.labelState.asReadonly();

  constructor() {
    void fetchVersion().then((body) => {
      this.labelState.set(versionLabel(body));
    });
  }
}

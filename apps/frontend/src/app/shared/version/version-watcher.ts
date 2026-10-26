import { DestroyRef, DOCUMENT, inject, Injectable, InjectionToken } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationError, Router } from '@angular/router';
import { filter, fromEvent } from 'rxjs';

export const VERSION_URL = '/version.json';
export const CHUNK_RELOAD_KEY = 'ardoise.chunk-reload';

export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => {
      location.reload();
    };
  },
});

const DEV_SHA = 'dev';
const CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const CHUNK_FAILURE =
  /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/;

async function fetchSha(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null || !('sha' in body)) return null;
    const { sha } = body;
    return typeof sha === 'string' && sha !== DEV_SHA ? sha : null;
  } catch {
    return null;
  }
}

function reloadedForChunkRecently(now: number): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY));
    return now - last < CHUNK_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function rememberChunkReload(now: number): void {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  } catch {
    return;
  }
}

const isChunkFailure = (error: unknown): boolean =>
  error instanceof Error && CHUNK_FAILURE.test(error.message);

@Injectable({ providedIn: 'root' })
export class VersionWatcher {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly reload = inject(PAGE_RELOAD);
  private readonly destroyRef = inject(DestroyRef);
  private baseline: string | null = null;

  start(): void {
    void this.check();

    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => void this.check());

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationError),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.recoverFromChunkFailure(event.error);
      });
  }

  private async check(): Promise<void> {
    const sha = await fetchSha();
    if (sha === null) return;
    if (this.baseline === null) {
      this.baseline = sha;
      return;
    }
    if (sha !== this.baseline) this.reload();
  }

  private recoverFromChunkFailure(error: unknown): void {
    const now = Date.now();
    if (!isChunkFailure(error) || reloadedForChunkRecently(now)) return;
    rememberChunkReload(now);
    this.reload();
  }
}

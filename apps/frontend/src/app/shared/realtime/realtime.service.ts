import { DOCUMENT, inject, Injectable, InjectionToken, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { type GroupEvent, type RealtimeMessage, realtimeMessageSchema } from '@ardoise/shared';
import { fromEvent, type Observable, Subject, take } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { API_BASE_URL } from 'src/app/shared/api-config';
import { PAGE_RELOAD } from 'src/app/shared/version/version-watcher';

export const HIDDEN_RELOAD_MS = 5 * 60 * 1000;

export const EVENT_SOURCE = new InjectionToken<(url: string) => EventSource>('EVENT_SOURCE', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url, { withCredentials: true }),
});

const parse = (data: unknown): RealtimeMessage | null => {
  if (typeof data !== 'string') return null;
  try {
    const result = realtimeMessageSchema.safeParse(JSON.parse(data));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly openSource = inject(EVENT_SOURCE);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly reload = inject(PAGE_RELOAD);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly eventSubject = new Subject<GroupEvent>();
  private readonly resyncSubject = new Subject<void>();
  private source: EventSource | null = null;
  private hiddenAt: number | null = null;
  private hasBeenReady = false;

  readonly events: Observable<GroupEvent> = this.eventSubject.asObservable();
  readonly resynced: Observable<void> = this.resyncSubject.asObservable();

  constructor() {
    fromEvent(this.document, 'visibilitychange').subscribe(() => {
      this.onVisibilityChange();
    });
  }

  connect(): void {
    if (this.source) return;
    this.hasBeenReady = false;
    const source = this.openSource(`${this.baseUrl}/events`);
    source.onmessage = (message: MessageEvent) => {
      this.onMessage(parse(message.data));
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) this.onClosed();
    };
    this.source = source;
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
    this.hiddenAt = null;
  }

  private onMessage(message: RealtimeMessage | null): void {
    if (message === null || message.type === 'ping') return;
    if (message.type === 'reset') {
      this.reload();
      return;
    }
    if (message.type === 'ready') {
      if (!this.hasBeenReady) this.resyncSubject.next();
      this.hasBeenReady = true;
      return;
    }
    this.eventSubject.next(message);
  }

  private onClosed(): void {
    this.disconnect();
    const auth = this.injector.get(AuthService);
    auth
      .revalidate()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.connect();
        },
        error: () => {
          void this.router.navigate(['/login']);
        },
      });
  }

  private onVisibilityChange(): void {
    if (!this.source) return;
    if (this.document.visibilityState === 'hidden') {
      this.hiddenAt ??= Date.now();
      return;
    }
    const hiddenFor = this.hiddenAt === null ? 0 : Date.now() - this.hiddenAt;
    this.hiddenAt = null;
    if (hiddenFor >= HIDDEN_RELOAD_MS) this.reload();
  }
}

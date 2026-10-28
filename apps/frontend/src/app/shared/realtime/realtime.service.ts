import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, inject, Injectable, InjectionToken } from '@angular/core';
import { Router } from '@angular/router';
import { type GroupEvent, type RealtimeMessage, realtimeMessageSchema } from '@ardoise/shared';
import { fromEvent, type Observable, Subject, type Subscription, take, timer } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { API_BASE_URL } from 'src/app/shared/api-config';
import { PAGE_RELOAD } from 'src/app/shared/version/version-watcher';

export const HIDDEN_RELOAD_MS = 5 * 60 * 1000;
export const INITIAL_RETRY_MS = 1000;
export const MAX_RETRY_MS = 30_000;

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
  private readonly auth = inject(AuthService);
  private readonly eventSubject = new Subject<GroupEvent>();
  private readonly resyncSubject = new Subject<void>();
  private source: EventSource | null = null;
  private hiddenAt: number | null = null;
  private wanted = false;
  private hasBeenReady = false;
  private retryMs = INITIAL_RETRY_MS;
  private revalidation: Subscription | null = null;
  private reconnection: Subscription | null = null;

  readonly events: Observable<GroupEvent> = this.eventSubject.asObservable();
  readonly resynced: Observable<void> = this.resyncSubject.asObservable();

  constructor() {
    fromEvent(this.document, 'visibilitychange').subscribe(() => {
      this.onVisibilityChange();
    });
    this.auth.signedOut.subscribe(() => {
      this.disconnect();
    });
  }

  connect(): void {
    if (this.source) return;
    this.cancelRecovery();
    this.wanted = true;
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
    this.cancelRecovery();
    this.closeSource();
    this.wanted = false;
    this.hiddenAt = null;
  }

  private cancelRecovery(): void {
    this.revalidation?.unsubscribe();
    this.reconnection?.unsubscribe();
    this.revalidation = null;
    this.reconnection = null;
  }

  private closeSource(): void {
    this.source?.close();
    this.source = null;
  }

  private onMessage(message: RealtimeMessage | null): void {
    if (message === null) return;
    if (message.type === 'reset') {
      this.reload();
      return;
    }
    if (message.type === 'ready') {
      this.retryMs = INITIAL_RETRY_MS;
      if (!this.hasBeenReady) this.resyncSubject.next();
      this.hasBeenReady = true;
      return;
    }
    this.eventSubject.next(message);
  }

  private onClosed(): void {
    this.cancelRecovery();
    this.closeSource();
    this.revalidation = this.auth
      .revalidate()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.reconnectAfterBackoff();
        },
        error: (error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.disconnect();
            void this.router.navigate(['/login']);
            return;
          }
          this.reconnectAfterBackoff();
        },
      });
  }

  private reconnectAfterBackoff(): void {
    const delay = this.retryMs;
    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
    this.reconnection = timer(delay).subscribe(() => {
      this.reconnection = null;
      this.connect();
    });
  }

  private onVisibilityChange(): void {
    if (!this.wanted) return;
    if (this.document.visibilityState === 'hidden') {
      this.hiddenAt ??= Date.now();
      return;
    }
    const hiddenFor = this.hiddenAt === null ? 0 : Date.now() - this.hiddenAt;
    this.hiddenAt = null;
    if (hiddenFor >= HIDDEN_RELOAD_MS) this.reload();
  }
}

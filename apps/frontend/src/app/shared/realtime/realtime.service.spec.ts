import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { PAGE_RELOAD } from 'src/app/shared/version/version-watcher';

import {
  EVENT_SOURCE,
  HIDDEN_RELOAD_MS,
  INITIAL_RETRY_MS,
  MAX_RETRY_MS,
  RealtimeService,
} from './realtime.service';

class FakeEventSource {
  static readonly CLOSED = 2;
  readyState = 1;
  closed = false;
  onmessage: ((message: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {}

  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  emit(data: unknown): void {
    this.onmessage?.({
      data: typeof data === 'string' ? data : JSON.stringify(data),
    } as MessageEvent);
  }

  fail(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

const setVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

function setup(revalidate: () => unknown = () => of({})) {
  vi.stubGlobal('EventSource', FakeEventSource);
  const sources: FakeEventSource[] = [];
  const reload = vi.fn();
  const navigate = vi.fn(() => Promise.resolve(true));
  TestBed.configureTestingModule({
    providers: [
      {
        provide: EVENT_SOURCE,
        useValue: (url: string) => {
          const source = new FakeEventSource(url);
          sources.push(source);
          return source;
        },
      },
      { provide: PAGE_RELOAD, useValue: reload },
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: { revalidate } },
    ],
  });
  const realtime = TestBed.inject(RealtimeService);
  const received: unknown[] = [];
  const resynced = vi.fn();
  realtime.events.subscribe((event) => received.push(event));
  realtime.resynced.subscribe(resynced);
  return { realtime, sources, reload, navigate, received, resynced };
}

const paymentDeleted = { type: 'payment.deleted', groupId: 1, opId: null, id: 4 };

describe('RealtimeService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('opens the events stream once however often it is asked', () => {
    const { realtime, sources } = setup();

    realtime.connect();
    realtime.connect();

    expect(sources).toHaveLength(1);
    expect(sources[0]?.url).toBe('/api/events');
  });

  it('closes the stream on disconnect', () => {
    const { realtime, sources } = setup();
    realtime.connect();

    realtime.disconnect();

    expect(sources[0]?.closed).toBe(true);
  });

  it('delivers group events', () => {
    const { realtime, sources, received } = setup();
    realtime.connect();

    sources[0]?.emit(paymentDeleted);

    expect(received).toEqual([paymentDeleted]);
  });

  it('drops pings and unparseable messages', () => {
    const { realtime, sources, received } = setup();
    realtime.connect();

    sources[0]?.emit({ type: 'ping' });
    sources[0]?.emit('not json');
    sources[0]?.emit({ type: 'payment.deleted' });

    expect(received).toEqual([]);
  });

  it('announces a resync on the first ready only', () => {
    const { realtime, sources, resynced } = setup();
    realtime.connect();

    sources[0]?.emit({ type: 'ready', id: 'a.0' });
    sources[0]?.emit({ type: 'ready', id: 'a.1' });

    expect(resynced).toHaveBeenCalledOnce();
  });

  it('reloads the page on reset', () => {
    const { realtime, sources, reload } = setup();
    realtime.connect();

    sources[0]?.emit({ type: 'reset', id: 'a.2' });

    expect(reload).toHaveBeenCalledOnce();
  });

  describe('after a long absence', () => {
    it('reloads when hidden for five minutes', () => {
      vi.useFakeTimers();
      const { realtime, reload } = setup();
      realtime.connect();

      setVisibility('hidden');
      vi.advanceTimersByTime(HIDDEN_RELOAD_MS);
      setVisibility('visible');

      expect(reload).toHaveBeenCalledOnce();
    });

    it('stays when hidden for four minutes', () => {
      vi.useFakeTimers();
      const { realtime, reload } = setup();
      realtime.connect();

      setVisibility('hidden');
      vi.advanceTimersByTime(4 * 60 * 1000);
      setVisibility('visible');

      expect(reload).not.toHaveBeenCalled();
    });

    it('stays when not connected', () => {
      vi.useFakeTimers();
      const { reload } = setup();

      setVisibility('hidden');
      vi.advanceTimersByTime(HIDDEN_RELOAD_MS);
      setVisibility('visible');

      expect(reload).not.toHaveBeenCalled();
    });
  });

  describe('when the stream closes', () => {
    it('goes to the login page when the session is gone', () => {
      const { realtime, sources, navigate } = setup(() => throwError(() => new Error('401')));
      realtime.connect();

      sources[0]?.fail();

      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('reconnects after a second when the session is still valid', () => {
      vi.useFakeTimers();
      const { realtime, sources, navigate } = setup();
      realtime.connect();

      sources[0]?.fail();
      expect(sources).toHaveLength(1);
      vi.advanceTimersByTime(INITIAL_RETRY_MS);

      expect(sources).toHaveLength(2);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('waits twice as long after a second failure in a row', () => {
      vi.useFakeTimers();
      const { realtime, sources } = setup();
      realtime.connect();
      sources[0]?.fail();
      vi.advanceTimersByTime(INITIAL_RETRY_MS);

      sources[1]?.fail();
      vi.advanceTimersByTime(INITIAL_RETRY_MS);
      expect(sources).toHaveLength(2);
      vi.advanceTimersByTime(INITIAL_RETRY_MS);

      expect(sources).toHaveLength(3);
    });

    it('never waits longer than the cap', () => {
      vi.useFakeTimers();
      const { realtime, sources } = setup();
      realtime.connect();

      for (let attempt = 0; attempt < 10; attempt++) {
        sources.at(-1)?.fail();
        vi.advanceTimersByTime(MAX_RETRY_MS);
      }
      const opened = sources.length;
      sources.at(-1)?.fail();
      vi.advanceTimersByTime(MAX_RETRY_MS);

      expect(sources).toHaveLength(opened + 1);
    });

    it('starts over at a second once the stream is ready again', () => {
      vi.useFakeTimers();
      const { realtime, sources } = setup();
      realtime.connect();
      sources[0]?.fail();
      vi.advanceTimersByTime(INITIAL_RETRY_MS);
      sources[1]?.emit({ type: 'ready', id: 'a.0' });

      sources[1]?.fail();
      vi.advanceTimersByTime(INITIAL_RETRY_MS);

      expect(sources).toHaveLength(3);
    });

    it('opens nothing when disconnected while a reconnect is pending', () => {
      vi.useFakeTimers();
      const { realtime, sources } = setup();
      realtime.connect();
      sources[0]?.fail();

      realtime.disconnect();
      vi.advanceTimersByTime(MAX_RETRY_MS);

      expect(sources).toHaveLength(1);
    });

    it('lets the browser retry on its own while the stream is still connecting', () => {
      const { realtime, sources } = setup();
      realtime.connect();

      const [source] = sources;
      if (source) source.readyState = 0;
      sources[0]?.onerror?.();

      expect(sources).toHaveLength(1);
    });
  });
});

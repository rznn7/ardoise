import { vi } from 'vitest';

class InertIntersectionObserver {
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);
}

if (!('IntersectionObserver' in globalThis)) {
  Object.assign(globalThis, { IntersectionObserver: InertIntersectionObserver });
}

class InertEventSource {
  static readonly CLOSED = 2;
  readyState = 0;
  onmessage = null;
  onerror = null;
  readonly close = vi.fn();
}

Object.assign(globalThis, { EventSource: InertEventSource });

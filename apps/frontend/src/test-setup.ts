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

import { signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { type Observable, tap } from 'rxjs';

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export type More = 'idle' | 'loading' | 'error' | 'end';

export type PagedState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'loaded';
      readonly items: readonly T[];
      readonly more: More;
      readonly boundary: T | undefined;
    };

interface Kept<T> {
  readonly groupId: number;
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly boundary: T | undefined;
}

const MAX_WALK_RESTARTS = 3;

interface PagedListOptions<T> {
  readonly version?: (groupId: number) => number;
  readonly accept?: (item: T) => boolean;
}

export class PagedList<T> {
  private latestWalk = 0;
  private readonly walking = signal(false);
  private readonly active = signal<number | null>(null);
  private readonly cursor = signal<string | undefined>(undefined);

  private readonly kept = signal<Kept<T> | undefined>(undefined);

  private readonly page = rxResource({
    params: () => {
      const groupId = this.active();
      return groupId === null ? undefined : { groupId, cursor: this.cursor() };
    },
    stream: ({ params }) =>
      this.fetch(params.groupId, params.cursor).pipe(
        tap((page) => {
          this.keep(params.groupId, params.cursor === undefined, page);
        }),
      ),
  });

  constructor(
    private readonly fetch: (groupId: number, cursor?: string) => Observable<Page<T>>,
    private readonly keyOf: (item: T) => string,
    private readonly newestFirst: (a: T, b: T) => number,
    private readonly options: PagedListOptions<T> = {},
  ) {}

  state(groupId: number): PagedState<T> {
    const kept = this.kept();
    if (kept?.groupId !== groupId) {
      return this.active() === groupId && this.page.error() !== undefined
        ? { status: 'error' }
        : { status: 'loading' };
    }
    return {
      status: 'loaded',
      items: kept.items,
      more: this.more(kept),
      boundary: kept.nextCursor === null ? undefined : kept.boundary,
    };
  }

  refreshState(groupId: number): 'idle' | 'loading' | 'error' {
    if (this.active() !== groupId || this.cursor() !== undefined) return 'idle';
    if (this.page.isLoading()) return 'loading';
    return this.page.error() === undefined ? 'idle' : 'error';
  }

  hasPages(groupId: number): boolean {
    return this.kept()?.groupId === groupId;
  }

  activeGroupId(): number | null {
    return this.active();
  }

  loadFirst(groupId: number): void {
    this.latestWalk++;
    this.walking.set(false);
    if (this.active() !== groupId) {
      this.active.set(groupId);
      this.cursor.set(undefined);
    } else if (this.cursor() !== undefined) {
      this.cursor.set(undefined);
    } else {
      this.page.reload();
    }
  }

  resync(groupId: number): void {
    const kept = this.kept();
    if (kept?.groupId !== groupId) {
      this.loadFirst(groupId);
      return;
    }
    this.walking.set(true);
    this.walk(groupId, kept.boundary, ++this.latestWalk);
  }

  loadMore(): void {
    const kept = this.kept();
    if (!kept || this.walking() || this.page.isLoading() || this.more(kept) !== 'idle') return;
    if (kept.nextCursor === null) return;
    if (this.cursor() === kept.nextCursor) this.page.reload();
    else this.cursor.set(kept.nextCursor);
  }

  retryMore(): void {
    const kept = this.kept();
    if (kept && this.more(kept) === 'error') this.page.reload();
  }

  patch(groupId: number, change: (items: readonly T[]) => readonly T[]): void {
    this.kept.update((kept) =>
      kept?.groupId === groupId ? { ...kept, items: change(kept.items) } : kept,
    );
  }

  private keep(groupId: number, first: boolean, page: Page<T>): void {
    this.kept.update((before) => {
      const keys = new Set(page.items.map(this.keyOf));
      const items =
        first || before?.groupId !== groupId
          ? page.items
          : [...before.items.filter((item) => !keys.has(this.keyOf(item))), ...page.items];
      return { groupId, items, nextCursor: page.nextCursor, boundary: page.items.at(-1) };
    });
  }

  private walk(groupId: number, boundary: T | undefined, walkId: number, restarts = 0): void {
    const startVersion = this.options.version?.(groupId);
    const pages: Page<T>[] = [];
    const step = (cursor?: string): void => {
      this.fetch(groupId, cursor).subscribe({
        next: (page) => {
          if (walkId !== this.latestWalk) return;
          if (this.active() !== groupId) {
            this.walking.set(false);
            return;
          }
          if (this.options.version?.(groupId) !== startVersion) {
            this.restartWalk(groupId, boundary, walkId, restarts);
            return;
          }
          pages.push(page);
          const last = page.items.at(-1);
          const kept = this.kept();
          const depth = kept?.groupId === groupId ? kept.boundary : boundary;
          const reachedDepth =
            last === undefined || depth === undefined || this.newestFirst(last, depth) >= 0;
          if (page.nextCursor !== null && !reachedDepth) {
            step(page.nextCursor);
            return;
          }
          this.walking.set(false);
          this.replace(groupId, pages);
        },
        error: () => {
          if (walkId === this.latestWalk) this.walking.set(false);
        },
      });
    };
    step();
  }

  private restartWalk(groupId: number, boundary: T | undefined, walkId: number, restarts: number) {
    if (restarts >= MAX_WALK_RESTARTS) {
      this.loadFirst(groupId);
      return;
    }
    this.walk(groupId, boundary, walkId, restarts + 1);
  }

  private replace(groupId: number, pages: readonly Page<T>[]): void {
    const accept = this.options.accept ?? (() => true);
    const seen = new Set<string>();
    const items = pages
      .flatMap((page) => page.items)
      .filter((item) => {
        const key = this.keyOf(item);
        if (seen.has(key) || !accept(item)) return false;
        seen.add(key);
        return true;
      });
    const last = pages.at(-1);
    this.kept.update((before) =>
      before?.groupId === groupId && last
        ? { groupId, items, nextCursor: last.nextCursor, boundary: last.items.at(-1) }
        : before,
    );
  }

  private more(kept: Kept<T>): More {
    if (kept.nextCursor === null) return 'end';
    if (this.walking()) return 'loading';
    if (this.cursor() === undefined) return 'idle';
    if (this.page.isLoading()) return 'loading';
    return this.page.error() === undefined ? 'idle' : 'error';
  }
}

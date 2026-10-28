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

export class PagedList<T> {
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
    if (this.kept()?.groupId !== groupId) {
      this.loadFirst(groupId);
      return;
    }
    this.fetch(groupId).subscribe({
      next: (page) => {
        this.merge(groupId, page);
      },
      error: () => undefined,
    });
  }

  loadMore(): void {
    const kept = this.kept();
    if (!kept || this.page.isLoading() || this.more(kept) !== 'idle') return;
    if (kept.nextCursor === null) return;
    this.cursor.set(kept.nextCursor);
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

  private merge(groupId: number, page: Page<T>): void {
    this.kept.update((before) => {
      if (before?.groupId !== groupId) return before;
      const fresh = page.items.at(-1);
      if (fresh === undefined) return before;
      const keys = new Set(page.items.map(this.keyOf));
      const older = before.items.filter(
        (item) => !keys.has(this.keyOf(item)) && this.newestFirst(item, fresh) > 0,
      );
      const reachesFurther = before.boundary !== undefined && this.newestFirst(before.boundary, fresh) > 0;
      return {
        groupId,
        items: [...page.items, ...older],
        nextCursor: reachesFurther ? before.nextCursor : page.nextCursor,
        boundary: reachesFurther ? before.boundary : fresh,
      };
    });
  }

  private more(kept: Kept<T>): More {
    if (kept.nextCursor === null) return 'end';
    if (this.cursor() === undefined) return 'idle';
    if (this.page.isLoading()) return 'loading';
    return this.page.error() === undefined ? 'idle' : 'error';
  }
}

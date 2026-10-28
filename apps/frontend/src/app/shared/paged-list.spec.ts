import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { type Page, PagedList, type PagedState } from './paged-list';

interface Request {
  readonly groupId: number;
  readonly cursor: string | undefined;
  readonly response: Subject<Page<number>>;
}

const itemsOf = (state: PagedState<number>) => (state.status === 'loaded' ? state.items : []);
const moreOf = (state: PagedState<number>) => (state.status === 'loaded' ? state.more : null);

describe(PagedList.name, () => {
  let requests: Request[];
  let list: PagedList<number>;

  beforeEach(() => {
    requests = [];
    list = TestBed.runInInjectionContext(
      () =>
        new PagedList<number>(
          (groupId, cursor) => {
            const response = new Subject<Page<number>>();
            requests.push({ groupId, cursor, response });
            return response;
          },
          (item) => String(item),
          (a, b) => a - b,
        ),
    );
  });

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };

  const answer = async (page: Page<number>) => {
    await settle();
    const request = requests.at(-1);
    if (!request) throw new Error('no request');
    request.response.next(page);
    request.response.complete();
    await settle();
  };

  const fail = async () => {
    await settle();
    requests.at(-1)?.response.error(new Error('offline'));
    await settle();
  };

  const firstPage = async () => {
    list.loadFirst(7);
    await answer({ items: [1, 2, 3], nextCursor: 'c1' });
  };

  it('loadFirst shows the first page with more to come', async () => {
    list.loadFirst(7);
    await settle();
    expect(list.state(7)).toEqual({ status: 'loading' });

    await answer({ items: [1, 2, 3], nextCursor: 'c1' });

    expect(list.state(7)).toEqual({
      status: 'loaded',
      items: [1, 2, 3],
      more: 'idle',
      boundary: 3,
    });
  });

  it('a failed first page is an error', async () => {
    list.loadFirst(7);
    await fail();

    expect(list.state(7)).toEqual({ status: 'error' });
  });

  it('loadMore appends the next page, asking with the cursor', async () => {
    await firstPage();

    list.loadMore();
    await settle();
    expect(requests.at(-1)?.cursor).toBe('c1');
    expect(moreOf(list.state(7))).toBe('loading');
    await answer({ items: [4, 5], nextCursor: null });

    expect(list.state(7)).toEqual({
      status: 'loaded',
      items: [1, 2, 3, 4, 5],
      more: 'end',
      boundary: undefined,
    });
  });

  it('loadMore is ignored while a page loads and at the end', async () => {
    await firstPage();

    list.loadMore();
    await settle();
    list.loadMore();
    await settle();
    expect(requests).toHaveLength(2);
    await answer({ items: [4], nextCursor: null });

    list.loadMore();
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('a failed next page keeps the rows, and retryMore asks again', async () => {
    await firstPage();
    list.loadMore();
    await fail();

    expect(list.state(7)).toEqual({
      status: 'loaded',
      items: [1, 2, 3],
      more: 'error',
      boundary: 3,
    });

    list.retryMore();
    await answer({ items: [4], nextCursor: null });
    expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 4]);
  });

  it('an appended page replaces items it already holds', async () => {
    await firstPage();
    list.patch(7, (items) => [...items, 4]);

    list.loadMore();
    await answer({ items: [4, 5], nextCursor: null });

    expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 4, 5]);
  });

  it('loadFirst again keeps the rows while page one reloads, then replaces them', async () => {
    await firstPage();
    list.loadMore();
    await answer({ items: [4], nextCursor: 'c2' });

    list.loadFirst(7);
    await settle();
    expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 4]);
    expect(requests.at(-1)?.cursor).toBeUndefined();
    await answer({ items: [0, 1], nextCursor: 'c3' });

    expect(itemsOf(list.state(7))).toEqual([0, 1]);
  });

  it('a refresh during loadMore keeps only the fresh first page', async () => {
    await firstPage();
    list.loadMore();
    await settle();
    const stale = requests.at(-1);

    list.loadFirst(7);
    await answer({ items: [9], nextCursor: null });
    stale?.response.next({ items: [4, 5], nextCursor: null });
    await settle();

    expect(itemsOf(list.state(7))).toEqual([9]);
  });

  it('does not ask for the next page while page one reloads', async () => {
    await firstPage();

    list.loadFirst(7);
    await settle();
    list.loadMore();
    await settle();

    expect(requests.filter((request) => request.cursor !== undefined)).toHaveLength(0);
  });

  it('a failed refresh keeps the rows', async () => {
    await firstPage();

    list.loadFirst(7);
    await fail();

    expect(list.state(7)).toEqual({
      status: 'loaded',
      items: [1, 2, 3],
      more: 'idle',
      boundary: 3,
    });
  });

  it('keeps one group: another group starts loading and the first is no longer held', async () => {
    await firstPage();

    list.loadFirst(8);
    await settle();

    expect(list.state(8)).toEqual({ status: 'loading' });
    expect(list.hasPages(7)).toBe(true);
    await answer({ items: [42], nextCursor: null });
    expect(list.hasPages(7)).toBe(false);
    expect(itemsOf(list.state(8))).toEqual([42]);
  });

  describe('resync', () => {
    const reply = async (page: Page<number>) => {
      const request = requests.at(-1);
      request?.response.next(page);
      request?.response.complete();
      await settle();
    };

    it('walks from the top down to the loaded depth and takes the last cursor', async () => {
      await firstPage();
      list.loadMore();
      await answer({ items: [4, 5], nextCursor: 'c2' });

      list.resync(7);
      await reply({ items: [0, 1, 2], nextCursor: 'f1' });
      expect(requests.at(-1)?.cursor).toBe('f1');
      await reply({ items: [3, 4, 5], nextCursor: 'f2' });

      expect(list.state(7)).toEqual({
        status: 'loaded',
        items: [0, 1, 2, 3, 4, 5],
        more: 'idle',
        boundary: 5,
      });
      list.loadMore();
      await settle();
      expect(requests.at(-1)?.cursor).toBe('f2');
    });

    it('loads the rows between a first page that overlaps nothing and the loaded depth', async () => {
      list.loadFirst(7);
      await answer({ items: [10, 11, 12], nextCursor: 'c1' });

      list.resync(7);
      await reply({ items: [1, 2, 3], nextCursor: 'f1' });
      await reply({ items: [4, 5, 6, 7, 8, 9], nextCursor: 'f2' });
      await reply({ items: [10, 11, 12], nextCursor: 'f3' });

      expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it('drops a row deleted beyond the first page', async () => {
      await firstPage();
      list.loadMore();
      await answer({ items: [4, 5], nextCursor: 'c2' });

      list.resync(7);
      await reply({ items: [1, 2, 3], nextCursor: 'f1' });
      await reply({ items: [5, 6], nextCursor: 'f2' });

      expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 5, 6]);
    });

    it('empties the list when the first page comes back empty', async () => {
      await firstPage();

      list.resync(7);
      await reply({ items: [], nextCursor: null });

      expect(itemsOf(list.state(7))).toEqual([]);
    });

    it('keeps the rows when the walk fails', async () => {
      await firstPage();

      list.resync(7);
      requests.at(-1)?.response.error(new Error('offline'));
      await settle();

      expect(itemsOf(list.state(7))).toEqual([1, 2, 3]);
    });

    it('loads the first page when nothing is kept for the group', async () => {
      list.resync(7);
      await settle();

      expect(requests.at(-1)?.cursor).toBeUndefined();
      await answer({ items: [1], nextCursor: null });
      expect(itemsOf(list.state(7))).toEqual([1]);
    });

    it('blocks loadMore while the walk is in flight, then lets it fetch', async () => {
      await firstPage();

      list.resync(7);
      expect(moreOf(list.state(7))).toBe('loading');
      const before = requests.length;
      list.loadMore();
      await settle();
      expect(requests).toHaveLength(before);

      await reply({ items: [1, 2, 3], nextCursor: 'c1' });
      expect(moreOf(list.state(7))).toBe('idle');
      list.loadMore();
      await settle();
      expect(requests.at(-1)?.cursor).toBe('c1');
    });

    it('keeps a page loaded during the walk and lets the next loadMore fetch after it', async () => {
      await firstPage();
      list.loadMore();
      await settle();
      const more = requests.at(-1);

      list.resync(7);
      const walk = requests.at(-1);
      more?.response.next({ items: [4, 5], nextCursor: 'c2' });
      more?.response.complete();
      await settle();
      walk?.response.next({ items: [1, 2, 3], nextCursor: 'c1' });
      walk?.response.complete();
      await settle();
      await reply({ items: [4, 5], nextCursor: 'c2' });

      expect(itemsOf(list.state(7))).toEqual([1, 2, 3, 4, 5]);
      list.loadMore();
      await settle();
      expect(requests.at(-1)?.cursor).toBe('c2');
    });

    it('loadMore fetches again when the kept cursor equals the current one', async () => {
      await firstPage();
      list.loadMore();
      await answer({ items: [4], nextCursor: 'c1' });
      const before = requests.length;

      list.loadMore();
      await settle();

      expect(requests).toHaveLength(before + 1);
      expect(requests.at(-1)?.cursor).toBe('c1');
    });

    it('is not overwritten by a walk once loadFirst landed', async () => {
      await firstPage();

      list.resync(7);
      const walk = requests.at(-1);
      list.loadFirst(7);
      await answer({ items: [7, 8], nextCursor: null });
      walk?.response.next({ items: [1, 2, 3], nextCursor: 'c1' });
      walk?.response.complete();
      await settle();

      expect(itemsOf(list.state(7))).toEqual([7, 8]);
    });

    it('stops walking when another group becomes active', async () => {
      await firstPage();

      list.resync(7);
      const walk = requests.at(-1);
      list.loadFirst(8);
      const before = requests.length;
      walk?.response.next({ items: [0], nextCursor: 'f1' });
      await settle();

      expect(requests.slice(before).filter((r) => r.groupId === 7)).toEqual([]);
    });

    it('falls back to loadFirst after four changes in a row', async () => {
      let version = 0;
      list = TestBed.runInInjectionContext(
        () =>
          new PagedList<number>(
            (groupId, cursor) => {
              const response = new Subject<Page<number>>();
              requests.push({ groupId, cursor, response });
              return response;
            },
            (item) => String(item),
            (a, b) => a - b,
            { version: () => version },
          ),
      );
      await firstPage();

      list.resync(7);
      for (let i = 0; i < 4; i++) {
        version++;
        await reply({ items: [0], nextCursor: 'f1' });
      }
      await settle();
      const request = requests.at(-1);
      expect(request?.cursor).toBeUndefined();
      await reply({ items: [5, 6], nextCursor: null });

      expect(itemsOf(list.state(7))).toEqual([5, 6]);
      expect(moreOf(list.state(7))).toBe('end');
    });

    it('starts over when a change lands between two pages of the walk', async () => {
      let version = 0;
      list = TestBed.runInInjectionContext(
        () =>
          new PagedList<number>(
            (groupId, cursor) => {
              const response = new Subject<Page<number>>();
              requests.push({ groupId, cursor, response });
              return response;
            },
            (item) => String(item),
            (a, b) => a - b,
            { version: () => version },
          ),
      );
      await firstPage();

      list.resync(7);
      await reply({ items: [0, 1], nextCursor: 'f1' });
      version++;
      list.patch(7, (items) => [...items, 99]);
      await reply({ items: [2, 3], nextCursor: null });

      expect(itemsOf(list.state(7))).toContain(99);
      expect(requests.at(-1)?.cursor).toBeUndefined();
      await reply({ items: [0, 1, 2, 3, 99], nextCursor: null });
      expect(itemsOf(list.state(7))).toEqual([0, 1, 2, 3, 99]);
    });
  });
});

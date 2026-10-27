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
});

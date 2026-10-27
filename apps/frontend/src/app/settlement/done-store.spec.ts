import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type SettlementResponse } from '@ardoise/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import { type DoneState, DoneStore } from './done-store';

const settlement = (id: number, settledAt: string): SettlementResponse => ({
  id,
  groupId: 7,
  fromMemberId: 2,
  toMemberId: 1,
  amount: 1000 * id,
  settledAt,
  createdByMemberId: 2,
  createdAt: settledAt,
});

const ids = (state: DoneState) =>
  state.status === 'loaded' ? state.settlements.map((s) => s.id) : [];

describe(DoneStore.name, () => {
  let store: DoneStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DoneStore);
    http = TestBed.inject(HttpTestingController);
  });

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };

  const loadDone = async (nextCursor: string | null = null) => {
    store.loadFirst(7);
    await settle();
    http.expectOne('/api/expense-groups/7/settlements').flush({
      items: [settlement(3, '2026-10-20T10:00:00.000Z'), settlement(2, '2026-10-10T10:00:00.000Z')],
      nextCursor,
    });
    await settle();
  };

  it('lists the repayments of its own endpoint, newest first', async () => {
    await loadDone();

    expect(ids(store.done(7)())).toEqual([3, 2]);
    expect(store.done(7)()).toMatchObject({ more: 'end' });
  });

  it('loads the next page with the cursor', async () => {
    await loadDone('c1');

    store.loadMore();
    await settle();
    http
      .expectOne('/api/expense-groups/7/settlements?cursor=c1')
      .flush({ items: [settlement(1, '2026-10-01T10:00:00.000Z')], nextCursor: null });
    await settle();

    expect(ids(store.done(7)())).toEqual([3, 2, 1]);
  });

  it('puts a saved repayment on top', async () => {
    await loadDone();

    store.added(7, settlement(9, '2026-10-26T10:00:00.000Z'));

    expect(ids(store.done(7)())).toEqual([9, 3, 2]);
  });

  it('hides a repayment while its undo is in flight, then drops it or puts it back', async () => {
    await loadDone();

    store.hide(3);
    expect(ids(store.done(7)())).toEqual([2]);
    store.unhide(3);
    expect(ids(store.done(7)())).toEqual([3, 2]);

    store.hide(2);
    store.removed(7, 2);
    expect(ids(store.done(7)())).toEqual([3]);
  });
});

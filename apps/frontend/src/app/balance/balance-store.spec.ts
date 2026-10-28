import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type GroupBalancesResponse, type GroupEvent } from '@ardoise/shared';
import { Subject } from 'rxjs';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BalanceStore } from './balance-store';

const owing: GroupBalancesResponse = {
  balances: [
    { memberId: 1, amount: -1500 },
    { memberId: 2, amount: 1500 },
  ],
  transfers: [{ fromMemberId: 1, toMemberId: 2, amount: 1500 }],
};

const settled: GroupBalancesResponse = {
  balances: [
    { memberId: 1, amount: 0 },
    { memberId: 2, amount: 0 },
  ],
  transfers: [],
};

const URL = '/api/expense-groups/7/balances';

describe(BalanceStore.name, () => {
  let store: BalanceStore;
  let http: HttpTestingController;
  let events: Subject<GroupEvent>;
  let resynced: Subject<void>;

  beforeEach(() => {
    events = new Subject<GroupEvent>();
    resynced = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RealtimeService, useValue: { events, resynced } },
      ],
    });
    store = TestBed.inject(BalanceStore);
    http = TestBed.inject(HttpTestingController);
  });

  it('goes from loading to loaded', () => {
    store.load(7);
    expect(store.balances(7)()).toEqual({ status: 'loading' });

    http.expectOne(URL).flush(owing);

    expect(store.balances(7)()).toEqual({ status: 'loaded', balances: owing });
  });

  it('keeps the last balances while reloading', () => {
    store.load(7);
    http.expectOne(URL).flush(owing);

    store.load(7);
    expect(store.balances(7)()).toEqual({ status: 'loaded', balances: owing });

    http.expectOne(URL).flush(settled);
    expect(store.balances(7)()).toEqual({ status: 'loaded', balances: settled });
  });

  it('reports an error when the first load fails', () => {
    store.load(7);
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.balances(7)()).toEqual({ status: 'error' });
  });

  it('keeps the last balances when a reload fails', () => {
    store.load(7);
    http.expectOne(URL).flush(owing);

    store.load(7);
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.balances(7)()).toEqual({ status: 'loaded', balances: owing });
  });

  it('ignores a response overtaken by a newer load', () => {
    store.load(7);
    store.load(7);
    const [first, second] = http.match(URL);

    second?.flush(settled);
    first?.flush(owing);

    expect(store.balances(7)()).toEqual({ status: 'loaded', balances: settled });
  });

  it('is refreshing while a reload of loaded balances is in flight', () => {
    const refreshing = store.refreshing(7);
    store.load(7);
    expect(refreshing()).toBe(false);
    http.expectOne(URL).flush(owing);

    store.load(7);
    expect(refreshing()).toBe(true);

    http.expectOne(URL).flush(settled);
    expect(refreshing()).toBe(false);
  });

  it('stops refreshing when a reload fails', () => {
    store.load(7);
    http.expectOne(URL).flush(owing);

    store.load(7);
    http.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.refreshing(7)()).toBe(false);
  });

  describe('live events', () => {
    const groupCreated = (groupId: number): GroupEvent => ({ type: 'group.created', groupId });

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reloads once for a burst of events', () => {
      store.load(7);
      http.expectOne(URL).flush(owing);

      events.next(groupCreated(7));
      vi.advanceTimersByTime(50);
      events.next(groupCreated(7));
      vi.advanceTimersByTime(50);
      events.next(groupCreated(7));
      vi.advanceTimersByTime(300);

      http.expectOne(URL).flush(settled);
      expect(store.balances(7)()).toEqual({ status: 'loaded', balances: settled });
    });

    it('ignores events about a group it has no balances for', () => {
      events.next(groupCreated(9));
      vi.advanceTimersByTime(1000);

      http.expectNone('/api/expense-groups/9/balances');
    });

    it('reloads every group it has when the connection resyncs', () => {
      store.load(7);
      http.expectOne(URL).flush(owing);

      resynced.next();

      http.expectOne(URL);
    });
  });
});

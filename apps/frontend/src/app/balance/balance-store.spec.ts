import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type GroupBalancesResponse } from '@ardoise/shared';
import { beforeEach, describe, expect, it } from 'vitest';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
});

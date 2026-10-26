import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type CreatePaymentBody, type PaymentResponse } from '@ardoise/shared';
import { ToastService } from 'src/app/shared/toast.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PaymentStore } from './payment-store';

const payment = (id: number, paidAt: string): PaymentResponse => ({
  id,
  payerMemberId: 1,
  groupId: 7,
  title: `Payment ${String(id)}`,
  paidAt,
  fullAmount: 1000,
  splitType: 'equal',
  createdAt: '2026-10-01T00:00:00.000Z',
});

const older = payment(1, '2026-10-01T10:00:00.000Z');
const newer = payment(2, '2026-10-05T10:00:00.000Z');
const newest = payment(3, '2026-10-20T10:00:00.000Z');

const body: CreatePaymentBody = {
  groupId: 7,
  payerMemberId: 1,
  title: 'Dinner',
  paidAt: '2026-10-10T10:00:00.000Z',
  fullAmount: 3000,
  splitType: 'equal',
  participants: [{ memberId: 1, inputValue: 0 }],
};

describe(PaymentStore.name, () => {
  let store: PaymentStore;
  let http: HttpTestingController;
  const error = vi.fn<(message: string) => void>();

  beforeEach(() => {
    error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error } },
      ],
    });
    store = TestBed.inject(PaymentStore);
    http = TestBed.inject(HttpTestingController);
  });

  const loadFeed = () => {
    store.load(7);
    http.expectOne('/api/expense-groups/7/payments').flush([older, newest, newer]);
  };

  const loadedIds = () => {
    const state = store.feed(7)();
    return state.status === 'loaded' ? state.payments.map((p) => p.id) : [];
  };

  it('load goes from loading to loaded, sorted by paidAt then id descending', () => {
    store.load(7);
    expect(store.feed(7)()).toEqual({ status: 'loading' });

    http.expectOne('/api/expense-groups/7/payments').flush([older, newest, newer]);

    expect(loadedIds()).toEqual([3, 2, 1]);
  });

  it('load failure sets the error status', () => {
    store.load(7);
    http
      .expectOne('/api/expense-groups/7/payments')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.feed(7)()).toEqual({ status: 'error' });
  });

  it('create shows a pending row before the response, then the confirmed row', () => {
    loadFeed();

    store.create(body);

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    const pending = state.payments.find((p) => p.pending);
    expect(pending?.id).toBeLessThan(0);
    expect(pending?.title).toBe('Dinner');
    expect(state.payments.map((p) => p.id)).toEqual([3, pending?.id, 2, 1]);

    const created = payment(9, body.paidAt);
    http.expectOne('/api/payments').flush({ payment: created, shares: [] });

    const after = store.feed(7)();
    if (after.status !== 'loaded') throw new Error('expected loaded');
    expect(after.payments.map((p) => p.id)).toEqual([3, 9, 2, 1]);
    expect(after.payments.every((p) => !p.pending)).toBe(true);
  });

  it('create refused removes the row and shows a toast', () => {
    loadFeed();

    store.create(body);
    http
      .expectOne('/api/payments')
      .flush({ error: 'EMPTY_PARTICIPANTS' }, { status: 400, statusText: 'Bad Request' });

    expect(loadedIds()).toEqual([3, 2, 1]);
    expect(error).toHaveBeenCalledWith("Couldn't save the payment");
  });

  it('remove hides the row at once and drops it for good on success', () => {
    loadFeed();

    store.remove(7, 2);
    expect(loadedIds()).toEqual([3, 1]);

    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });
    expect(loadedIds()).toEqual([3, 1]);
    expect(error).not.toHaveBeenCalled();
  });

  it('remove refused puts the row back in its place and shows a toast', () => {
    loadFeed();

    store.remove(7, 2);
    http.expectOne('/api/payments/2').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(loadedIds()).toEqual([3, 2, 1]);
    expect(error).toHaveBeenCalledWith("Couldn't delete the payment");
  });

  it('update replaces the row with the server payment', () => {
    loadFeed();
    const { groupId: _groupId, ...updateBody } = {
      ...body,
      title: 'Renamed',
      paidAt: '2026-10-25T10:00:00.000Z',
    };

    store.update(1, updateBody);
    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(state.payments.map((p) => p.id)).toEqual([1, 3, 2]);
    expect(state.payments[0]?.title).toBe('Renamed');

    const saved = { ...payment(1, updateBody.paidAt), title: 'Renamed' };
    http.expectOne('/api/payments/1').flush({ payment: saved, shares: [] });

    expect(loadedIds()).toEqual([1, 3, 2]);
    expect(error).not.toHaveBeenCalled();
  });

  it('update refused restores the previous rows and shows a toast', () => {
    loadFeed();
    const { groupId: _groupId, ...updateBody } = { ...body, paidAt: '2026-10-25T10:00:00.000Z' };

    store.update(1, updateBody);
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(state.payments.map((p) => p.id)).toEqual([3, 2, 1]);
    expect(state.payments.find((p) => p.id === 1)?.title).toBe('Payment 1');
    expect(error).toHaveBeenCalledWith("Couldn't update the payment");
  });
});

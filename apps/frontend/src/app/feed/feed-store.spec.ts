import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type CreatePaymentBody,
  type CreateSettlementBody,
  type FeedItem,
  type PaymentResponse,
  type SettlementResponse,
} from '@ardoise/shared';
import { ToastService } from 'src/app/shared/toast.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type FeedState, FeedStore } from './feed-store';

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

const items = (...payments: PaymentResponse[]): FeedItem[] =>
  payments.map((p) => ({ kind: 'payment', payment: p }));

const paymentRows = (state: FeedState) =>
  state.status === 'loaded'
    ? state.rows.flatMap((row) =>
        row.kind === 'payment' ? [{ ...row.payment, pending: row.pending }] : [],
      )
    : [];

const body: CreatePaymentBody = {
  groupId: 7,
  payerMemberId: 1,
  title: 'Dinner',
  paidAt: '2026-10-10T10:00:00.000Z',
  fullAmount: 3000,
  splitType: 'equal',
  participants: [{ memberId: 1, inputValue: 0 }],
};

describe(FeedStore.name, () => {
  let store: FeedStore;
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
    store = TestBed.inject(FeedStore);
    http = TestBed.inject(HttpTestingController);
  });

  const loadFeed = () => {
    store.load(7);
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newest, newer));
  };

  const loadedIds = () => {
    const state = store.feed(7)();
    return paymentRows(state).map((p) => p.id);
  };

  it('load goes from loading to loaded, sorted by paidAt then id descending', () => {
    store.load(7);
    expect(store.feed(7)()).toEqual({ status: 'loading' });

    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newest, newer));

    expect(loadedIds()).toEqual([3, 2, 1]);
  });

  it('load failure sets the error status', () => {
    store.load(7);
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(store.feed(7)()).toEqual({ status: 'error' });
  });

  it('create shows a pending row before the response, then the confirmed row', () => {
    loadFeed();

    store.create(body);

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    const pending = paymentRows(state).find((p) => p.pending);
    expect(pending?.id).toBeLessThan(0);
    expect(pending?.title).toBe('Dinner');
    expect(paymentRows(state).map((p) => p.id)).toEqual([3, pending?.id, 2, 1]);

    const created = payment(9, body.paidAt);
    http.expectOne('/api/payments').flush({ payment: created, shares: [] });

    const after = store.feed(7)();
    if (after.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(after).map((p) => p.id)).toEqual([3, 9, 2, 1]);
    expect(paymentRows(after).every((p) => !p.pending)).toBe(true);
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

    store.update(7, 1, updateBody);
    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(state).map((p) => p.id)).toEqual([1, 3, 2]);
    expect(paymentRows(state)[0]?.title).toBe('Renamed');

    const saved = { ...payment(1, updateBody.paidAt), title: 'Renamed' };
    http.expectOne('/api/payments/1').flush({ payment: saved, shares: [] });

    expect(loadedIds()).toEqual([1, 3, 2]);
    expect(error).not.toHaveBeenCalled();
  });

  it('update refused restores the previous rows and shows a toast', () => {
    loadFeed();
    const { groupId: _groupId, ...updateBody } = { ...body, paidAt: '2026-10-25T10:00:00.000Z' };

    store.update(7, 1, updateBody);
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(state).map((p) => p.id)).toEqual([3, 2, 1]);
    expect(paymentRows(state).find((p) => p.id === 1)?.title).toBe('Payment 1');
    expect(error).toHaveBeenCalledWith("Couldn't update the payment");
  });

  it('update with no loaded feed still issues the request', () => {
    const { groupId: _groupId, ...updateBody } = body;

    store.update(7, 1, updateBody);

    http.expectOne({ method: 'PUT', url: '/api/payments/1' });
  });

  it('remove with no loaded feed still issues DELETE', () => {
    store.remove(7, 1);

    http.expectOne({ method: 'DELETE', url: '/api/payments/1' });
  });

  it('create with no loaded feed still POSTs', () => {
    expect(() => {
      store.create(body);
    }).not.toThrow();

    http.expectOne({ method: 'POST', url: '/api/payments' });
  });

  it('a failed remove keeps a payment created meanwhile', () => {
    loadFeed();

    store.remove(7, 2);
    store.create(body);
    http.expectOne('/api/payments/2').flush(null, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });

    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('a failed remove does not resurrect another removed payment', () => {
    loadFeed();

    store.remove(7, 1);
    store.remove(7, 2);
    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne('/api/payments/1').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(loadedIds()).toEqual([3, 1]);
  });
  it('a second load keeps the rows visible while it revalidates', () => {
    loadFeed();

    store.load(7);

    expect(loadedIds()).toEqual([3, 2, 1]);
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newer));
    expect(loadedIds()).toEqual([2, 1]);
  });

  it('a failed revalidation keeps the loaded rows', () => {
    loadFeed();

    store.load(7);
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush(null, { status: 500, statusText: 'Server Error' });

    expect(loadedIds()).toEqual([3, 2, 1]);
  });

  it('a load during an in-flight delete keeps the row hidden', () => {
    loadFeed();
    store.remove(7, 2);

    store.load(7);
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newer, newest));
    expect(loadedIds()).toEqual([3, 1]);

    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });
    expect(loadedIds()).toEqual([3, 1]);
  });

  it('a load during an in-flight create keeps the pending row, then confirms it', () => {
    loadFeed();
    store.create(body);

    store.load(7);
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newer, newest));
    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(
      paymentRows(state)
        .filter((p) => p.pending)
        .map((p) => p.title),
    ).toEqual(['Dinner']);

    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });
    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('a load that started before a create settled is fetched again', () => {
    loadFeed();
    store.create(body);
    store.load(7);

    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newer, newest));
    expect(loadedIds()).toEqual([3, 9, 2, 1]);

    http
      .expectOne('/api/expense-groups/7/feed')
      .flush(items(older, newer, newest, payment(9, body.paidAt)));
    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('the first load during an in-flight create shows the pending row', () => {
    store.create(body);
    store.load(7);

    http.expectOne('/api/expense-groups/7/feed').flush(items(older));

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(state).map((p) => p.title)).toEqual(['Dinner', 'Payment 1']);
  });

  it('an update overlay survives a refetch until the update settles', () => {
    loadFeed();
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);

    store.load(7);
    http.expectOne('/api/expense-groups/7/feed').flush(items(older, newer, newest));

    const titleOf1 = () => {
      const state = store.feed(7)();
      return paymentRows(state).find((p) => p.id === 1)?.title ?? null;
    };
    expect(titleOf1()).toBe('Renamed');
    expect(store.pendingUpdate(1)()).toEqual(updateBody);

    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });
    expect(titleOf1()).toBe('Payment 1');
    expect(store.pendingUpdate(1)()).toBeNull();
  });

  it('remembers the body of an update the server confirmed', () => {
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);
    expect(store.confirmedUpdate(1)).toBeNull();

    http
      .expectOne('/api/payments/1')
      .flush({ payment: { ...payment(1, updateBody.paidAt), title: 'Renamed' }, shares: [] });

    expect(store.confirmedUpdate(1)).toEqual(updateBody);
  });

  it('forgets the confirmed body when a later update is refused', () => {
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);
    http
      .expectOne('/api/payments/1')
      .flush({ payment: { ...payment(1, updateBody.paidAt), title: 'Renamed' }, shares: [] });

    store.update(7, 1, { ...updateBody, title: 'Again' });
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });

    expect(store.confirmedUpdate(1)).toBeNull();
  });

  it('counts each settled mutation of a group, confirmed or failed', () => {
    loadFeed();
    const version = store.settledVersion(7);
    expect(version()).toBe(0);

    store.create(body);
    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });
    expect(version()).toBe(1);

    const { groupId: _groupId, ...unchanged } = body;
    store.update(7, 1, unchanged);
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });
    expect(version()).toBe(2);
    expect(store.settledVersion(8)()).toBe(0);
  });

  describe('settlements', () => {
    const settlement = (id: number, settledAt: string): SettlementResponse => ({
      id,
      groupId: 7,
      fromMemberId: 2,
      toMemberId: 1,
      amount: 3000,
      settledAt,
      createdByMemberId: 2,
      createdAt: settledAt,
    });
    const repaid = settlement(4, '2026-10-06T10:00:00.000Z');
    const repayment: CreateSettlementBody = {
      groupId: 7,
      fromMemberId: 2,
      toMemberId: 1,
      amount: 3000,
    };

    const loadMixed = () => {
      store.load(7);
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush([...items(older, newest), { kind: 'settlement', settlement: repaid }]);
    };

    const settlementRows = () => {
      const state = store.feed(7)();
      return state.status === 'loaded'
        ? state.rows.flatMap((row) =>
            row.kind === 'settlement' ? [{ id: row.settlement.id, pending: row.pending }] : [],
          )
        : [];
    };

    it('sorts settlements among payments by date', () => {
      loadMixed();

      const state = store.feed(7)();
      if (state.status !== 'loaded') throw new Error('expected loaded');
      expect(state.rows.map((row) => row.kind)).toEqual(['payment', 'settlement', 'payment']);
    });

    it('recordSettlement shows a pending row then the confirmed one', () => {
      loadMixed();

      store.recordSettlement(repayment);
      const [pending] = settlementRows().filter((row) => row.pending);
      expect(pending?.id).toBeLessThan(0);
      expect(store.pendingSettlements(7)()).toEqual([repayment]);

      http.expectOne('/api/settlements').flush(settlement(5, '2026-10-26T10:00:00.000Z'));

      expect(settlementRows()).toEqual([
        { id: 5, pending: false },
        { id: 4, pending: false },
      ]);
      expect(store.pendingSettlements(7)()).toEqual([]);
    });

    it('record failure drops the row and toasts', () => {
      loadMixed();

      store.recordSettlement(repayment);
      http.expectOne('/api/settlements').flush(null, { status: 403, statusText: 'Forbidden' });

      expect(settlementRows()).toEqual([{ id: 4, pending: false }]);
      expect(error).toHaveBeenCalledWith("Couldn't record the repayment");
    });

    it('undo hides then removes', () => {
      loadMixed();

      store.undoSettlement(7, 4);
      expect(settlementRows()).toEqual([]);

      http.expectOne('/api/settlements/4').flush(null, { status: 204, statusText: 'No Content' });
      expect(settlementRows()).toEqual([]);
    });

    it('undo failure restores the row', () => {
      loadMixed();

      store.undoSettlement(7, 4);
      http.expectOne('/api/settlements/4').flush(null, { status: 403, statusText: 'Forbidden' });

      expect(settlementRows()).toEqual([{ id: 4, pending: false }]);
      expect(error).toHaveBeenCalledWith("Couldn't undo the repayment");
    });

    it('undoing a settlement leaves a payment with the same id alone', () => {
      store.load(7);
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush([
          ...items(payment(4, '2026-10-01T10:00:00.000Z')),
          { kind: 'settlement', settlement: repaid },
        ]);

      store.undoSettlement(7, 4);

      expect(paymentRows(store.feed(7)()).map((p) => p.id)).toEqual([4]);
    });

    it('counts settled settlement mutations', () => {
      loadMixed();
      const version = store.settledVersion(7);

      store.recordSettlement(repayment);
      http.expectOne('/api/settlements').flush(settlement(5, '2026-10-26T10:00:00.000Z'));
      store.undoSettlement(7, 5);
      http.expectOne('/api/settlements/5').flush(null, { status: 204, statusText: 'No Content' });

      expect(version()).toBe(2);
    });
  });
});

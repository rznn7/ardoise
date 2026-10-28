import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type CreatePaymentBody,
  type CreateSettlementBody,
  type FeedItem,
  type GroupEvent,
  type PaymentResponse,
  type SettlementResponse,
} from '@ardoise/shared';
import { Subject } from 'rxjs';
import { DoneStore } from 'src/app/settlement/done-store';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
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
  let events: Subject<GroupEvent>;
  let resynced: Subject<void>;

  beforeEach(() => {
    error.mockClear();
    events = new Subject<GroupEvent>();
    resynced = new Subject<void>();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error } },
        { provide: RealtimeService, useValue: { events, resynced } },
      ],
    });
    store = TestBed.inject(FeedStore);
    http = TestBed.inject(HttpTestingController);
  });

  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      TestBed.tick();
      await Promise.resolve();
    }
  };

  const loadFeed = async () => {
    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newest, newer), nextCursor: null });
    await settle();
  };

  const loadedIds = () => {
    const state = store.feed(7)();
    return paymentRows(state).map((p) => p.id);
  };

  it('load goes from loading to loaded, sorted by paidAt then id descending', async () => {
    store.loadFirst(7);
    await settle();
    expect(store.feed(7)()).toEqual({ status: 'loading' });

    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newest, newer), nextCursor: null });

    await settle();

    expect(loadedIds()).toEqual([3, 2, 1]);
  });

  it('load failure sets the error status', async () => {
    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(store.feed(7)()).toEqual({ status: 'error' });
  });

  it('create shows a pending row before the response, then the confirmed row', async () => {
    await loadFeed();

    store.create(body);

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    const pending = paymentRows(state).find((p) => p.pending);
    expect(pending?.id).toBeLessThan(0);
    expect(pending?.title).toBe('Dinner');
    expect(paymentRows(state).map((p) => p.id)).toEqual([3, pending?.id, 2, 1]);

    const created = payment(9, body.paidAt);
    http.expectOne('/api/payments').flush({ payment: created, shares: [] });
    await settle();

    const after = store.feed(7)();
    if (after.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(after).map((p) => p.id)).toEqual([3, 9, 2, 1]);
    expect(paymentRows(after).every((p) => !p.pending)).toBe(true);
  });

  it('create refused removes the row and shows a toast', async () => {
    await loadFeed();

    store.create(body);
    http
      .expectOne('/api/payments')
      .flush({ error: 'EMPTY_PARTICIPANTS' }, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(loadedIds()).toEqual([3, 2, 1]);
    expect(error).toHaveBeenCalledWith("Couldn't save the payment");
  });

  it('remove hides the row at once and drops it for good on success', async () => {
    await loadFeed();

    store.remove(7, 2);
    expect(loadedIds()).toEqual([3, 1]);

    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });

    await settle();
    expect(loadedIds()).toEqual([3, 1]);
    expect(error).not.toHaveBeenCalled();
  });

  it('remove refused puts the row back in its place and shows a toast', async () => {
    await loadFeed();

    store.remove(7, 2);
    http.expectOne('/api/payments/2').flush(null, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(loadedIds()).toEqual([3, 2, 1]);
    expect(error).toHaveBeenCalledWith("Couldn't delete the payment");
  });

  it('update replaces the row with the server payment', async () => {
    await loadFeed();
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
    await settle();

    expect(loadedIds()).toEqual([1, 3, 2]);
    expect(error).not.toHaveBeenCalled();
  });

  it('update refused restores the previous rows and shows a toast', async () => {
    await loadFeed();
    const { groupId: _groupId, ...updateBody } = { ...body, paidAt: '2026-10-25T10:00:00.000Z' };

    store.update(7, 1, updateBody);
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();

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

  it('a failed remove keeps a payment created meanwhile', async () => {
    await loadFeed();

    store.remove(7, 2);
    store.create(body);
    http.expectOne('/api/payments/2').flush(null, { status: 403, statusText: 'Forbidden' });
    await settle();
    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });
    await settle();

    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('a failed remove does not resurrect another removed payment', async () => {
    await loadFeed();

    store.remove(7, 1);
    store.remove(7, 2);
    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    http.expectOne('/api/payments/1').flush(null, { status: 403, statusText: 'Forbidden' });
    await settle();

    expect(loadedIds()).toEqual([3, 1]);
  });
  it('a second load keeps the rows visible while it revalidates', async () => {
    await loadFeed();

    store.loadFirst(7);
    await settle();

    expect(loadedIds()).toEqual([3, 2, 1]);
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer), nextCursor: null });
    await settle();
    expect(loadedIds()).toEqual([2, 1]);
  });

  it('a failed revalidation keeps the loaded rows', async () => {
    await loadFeed();

    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(loadedIds()).toEqual([3, 2, 1]);
  });

  it('a load during an in-flight delete keeps the row hidden', async () => {
    await loadFeed();
    store.remove(7, 2);

    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer, newest), nextCursor: null });
    await settle();
    expect(loadedIds()).toEqual([3, 1]);

    http.expectOne('/api/payments/2').flush(null, { status: 204, statusText: 'No Content' });

    await settle();
    expect(loadedIds()).toEqual([3, 1]);
  });

  it('a load during an in-flight create keeps the pending row, then confirms it', async () => {
    await loadFeed();
    store.create(body);

    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer, newest), nextCursor: null });
    await settle();
    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(
      paymentRows(state)
        .filter((p) => p.pending)
        .map((p) => p.title),
    ).toEqual(['Dinner']);

    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });

    await settle();
    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('a load that started before a create settled is fetched again', async () => {
    await loadFeed();
    store.create(body);
    store.loadFirst(7);
    await settle();

    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });

    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer, newest), nextCursor: null });
    await settle();
    expect(loadedIds()).toEqual([3, 9, 2, 1]);

    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer, newest, payment(9, body.paidAt)), nextCursor: null });

    await settle();
    expect(loadedIds()).toEqual([3, 9, 2, 1]);
  });

  it('the first load during an in-flight create shows the pending row', async () => {
    store.create(body);
    store.loadFirst(7);
    await settle();

    http.expectOne('/api/expense-groups/7/feed').flush({ items: items(older), nextCursor: null });

    await settle();

    const state = store.feed(7)();
    if (state.status !== 'loaded') throw new Error('expected loaded');
    expect(paymentRows(state).map((p) => p.title)).toEqual(['Dinner', 'Payment 1']);
  });

  it('an update overlay survives a refetch until the update settles', async () => {
    await loadFeed();
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);

    store.loadFirst(7);
    await settle();
    http
      .expectOne('/api/expense-groups/7/feed')
      .flush({ items: items(older, newer, newest), nextCursor: null });
    await settle();

    const titleOf1 = () => {
      const state = store.feed(7)();
      return paymentRows(state).find((p) => p.id === 1)?.title ?? null;
    };
    expect(titleOf1()).toBe('Renamed');
    expect(store.pendingUpdate(1)()).toEqual(updateBody);

    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });

    await settle();
    expect(titleOf1()).toBe('Payment 1');
    expect(store.pendingUpdate(1)()).toBeNull();
  });

  it('remembers the body of an update the server confirmed', async () => {
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);
    expect(store.confirmedUpdate(1)).toBeNull();

    http
      .expectOne('/api/payments/1')
      .flush({ payment: { ...payment(1, updateBody.paidAt), title: 'Renamed' }, shares: [] });

    await settle();

    expect(store.confirmedUpdate(1)).toEqual(updateBody);
  });

  it('forgets the confirmed body when a later update is refused', async () => {
    const { groupId: _groupId, ...updateBody } = { ...body, title: 'Renamed' };
    store.update(7, 1, updateBody);
    http
      .expectOne('/api/payments/1')
      .flush({ payment: { ...payment(1, updateBody.paidAt), title: 'Renamed' }, shares: [] });
    await settle();

    store.update(7, 1, { ...updateBody, title: 'Again' });
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();

    expect(store.confirmedUpdate(1)).toBeNull();
  });

  it('counts each settled mutation of a group, confirmed or failed', async () => {
    await loadFeed();
    const version = store.settledVersion(7);
    expect(version()).toBe(0);

    store.create(body);
    http.expectOne('/api/payments').flush({ payment: payment(9, body.paidAt), shares: [] });
    await settle();
    expect(version()).toBe(1);

    const { groupId: _groupId, ...unchanged } = body;
    store.update(7, 1, unchanged);
    http.expectOne('/api/payments/1').flush(null, { status: 400, statusText: 'Bad Request' });
    await settle();
    expect(version()).toBe(2);
    expect(store.settledVersion(8)()).toBe(0);
  });

  describe('pages', () => {
    const firstPage = async () => {
      store.loadFirst(7);
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, newer), nextCursor: 'c1' });
      await settle();
    };

    it('says more can be loaded, then asks for the next page with the cursor', async () => {
      await firstPage();
      expect(store.feed(7)()).toMatchObject({ status: 'loaded', more: 'idle' });

      store.loadMore();
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed?cursor=c1')
        .flush({ items: items(older), nextCursor: null });
      await settle();

      expect(loadedIds()).toEqual([3, 2, 1]);
      expect(store.feed(7)()).toMatchObject({ more: 'end' });
    });

    it('hides a payment created past the last loaded row until its page arrives', async () => {
      await firstPage();

      store.create({ ...body, paidAt: '2026-09-01T10:00:00.000Z' });
      expect(paymentRows(store.feed(7)()).map((p) => p.title)).not.toContain('Dinner');
      http
        .expectOne('/api/payments')
        .flush({ payment: payment(9, '2026-09-01T10:00:00.000Z'), shares: [] });
      await settle();
      expect(loadedIds()).toEqual([3, 2]);

      store.loadMore();
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed?cursor=c1')
        .flush({ items: items(older, payment(9, '2026-09-01T10:00:00.000Z')), nextCursor: null });
      await settle();
      expect(loadedIds()).toEqual([3, 2, 1, 9]);
    });
  });

  describe('live events', () => {
    const saved = (p: PaymentResponse, opId: string | null = null): GroupEvent => ({
      type: 'payment.saved',
      groupId: 7,
      opId,
      payment: p,
    });
    const deleted = (id: number): GroupEvent => ({
      type: 'payment.deleted',
      groupId: 7,
      opId: null,
      id,
    });
    const theirs = payment(10, '2026-10-10T10:00:00.000Z');

    it('inserts a payment from someone else at its date', async () => {
      await loadFeed();

      events.next(saved(theirs));

      expect(loadedIds()).toEqual([3, 10, 2, 1]);
    });

    it('replaces a payment with the same id', async () => {
      await loadFeed();
      events.next(saved(theirs));

      events.next(saved({ ...theirs, title: 'Renamed' }));

      expect(paymentRows(store.feed(7)()).filter((p) => p.id === 10)).toEqual([
        { ...theirs, title: 'Renamed', pending: false },
      ]);
    });

    it('does not show a payment older than the loaded boundary', async () => {
      store.loadFirst(7);
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, newer), nextCursor: 'more' });
      await settle();

      events.next(saved(payment(11, '2026-09-01T10:00:00.000Z')));

      expect(loadedIds()).toEqual([3, 2]);
    });

    it('hides a payment edited to a date past the boundary', async () => {
      store.loadFirst(7);
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, newer), nextCursor: 'more' });
      await settle();

      events.next(saved({ ...newer, paidAt: '2026-09-01T10:00:00.000Z' }));

      expect(loadedIds()).toEqual([3]);
    });

    it('removes a deleted payment', async () => {
      await loadFeed();

      events.next(deleted(2));

      expect(loadedIds()).toEqual([3, 1]);
    });

    it('keeps a payment removed when a late save arrives after its deletion', async () => {
      await loadFeed();
      events.next(deleted(2));

      events.next(saved(newer));

      expect(loadedIds()).toEqual([3, 1]);
    });

    it('keeps a payment removed after the own delete succeeded', async () => {
      await loadFeed();
      store.remove(7, 2);
      http.expectOne({ method: 'DELETE', url: '/api/payments/2' }).flush(null);

      events.next(saved(newer));

      expect(loadedIds()).toEqual([3, 1]);
    });

    it('does not remember an own edit whose response arrives after an event on the same payment', async () => {
      await loadFeed();
      const { groupId: _groupId, ...updateBody } = { ...body, title: 'Mine' };
      store.update(7, 2, updateBody);
      const request = http.expectOne({ method: 'PUT', url: '/api/payments/2' });

      events.next(
        saved({ ...newer, title: 'Theirs' }, request.request.headers.get('x-op-id')),
      );
      request.flush({ payment: { ...newer, title: 'Mine' }, shares: [] });

      expect(store.confirmedUpdate(2)).toBeNull();
    });

    it('forgets a remembered own edit when someone else saves the payment', async () => {
      await loadFeed();
      const { groupId: _groupId, ...updateBody } = { ...body, title: 'Mine' };
      store.update(7, 2, updateBody);
      http.expectOne({ method: 'PUT', url: '/api/payments/2' }).flush({
        payment: { ...newer, title: 'Mine' },
        shares: [],
      });
      await settle();
      expect(store.confirmedUpdate(2)).toEqual(updateBody);

      events.next(saved({ ...newer, title: 'Theirs' }));

      expect(store.confirmedUpdate(2)).toBeNull();
    });

    it('keeps older loaded pages when the connection resyncs', async () => {
      store.loadFirst(7);
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, newer), nextCursor: 'more' });
      await settle();
      store.loadMore();
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed?cursor=more')
        .flush({ items: items(older), nextCursor: null });
      await settle();

      resynced.next();
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, theirs), nextCursor: 'more' });
      await settle();

      expect(loadedIds()).toEqual([3, 10, 2, 1]);
    });

    it('shows one row when the event of an own create arrives before the response', async () => {
      await loadFeed();
      store.create(body);
      const request = http.expectOne({ method: 'POST', url: '/api/payments' });
      const confirmed = payment(20, body.paidAt);

      events.next(saved(confirmed, request.request.headers.get('x-op-id')));

      expect(paymentRows(store.feed(7)()).filter((p) => p.id < 0 || p.id === 20)).toEqual([
        { ...confirmed, pending: false },
      ]);

      request.flush({ payment: confirmed });

      expect(paymentRows(store.feed(7)()).filter((p) => p.id < 0 || p.id === 20)).toEqual([
        { ...confirmed, pending: false },
      ]);
    });

    it('keeps an event that arrives during the first fetch', async () => {
      store.loadFirst(7);
      await settle();
      const first = http.expectOne('/api/expense-groups/7/feed');

      events.next(saved(theirs));
      first.flush({ items: items(older, newest, newer), nextCursor: null });
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(older, newest, newer, theirs), nextCursor: null });
      await settle();

      expect(loadedIds()).toEqual([3, 10, 2, 1]);
    });

    it('keeps the pending update overlay when the row is saved by an event', async () => {
      await loadFeed();
      const update = {
        payerMemberId: 1,
        title: 'Mine',
        paidAt: newer.paidAt,
        fullAmount: 1,
        splitType: 'equal' as const,
        participants: [{ memberId: 1, inputValue: 0 }],
      };
      store.update(7, 2, update);

      events.next(saved({ ...newer, title: 'Theirs' }));

      expect(paymentRows(store.feed(7)()).find((p) => p.id === 2)?.title).toBe('Mine');
    });

    it('reloads the first page when the connection resyncs', async () => {
      await loadFeed();

      resynced.next();
      await settle();

      http.expectOne('/api/expense-groups/7/feed');
    });

    it('ignores a payment of a group whose pages are not kept', async () => {
      await loadFeed();

      events.next({ ...saved(theirs), groupId: 8 });

      expect(loadedIds()).toEqual([3, 2, 1]);
    });

    it('keeps a payment removed when its own create resolves after its deletion', async () => {
      await loadFeed();
      store.create(body);
      const request = http.expectOne({ method: 'POST', url: '/api/payments' });
      const confirmed = payment(20, body.paidAt);

      events.next(deleted(20));
      request.flush({ payment: confirmed });

      expect(loadedIds()).toEqual([3, 2, 1]);
    });

    it('drops the pending row and shows nothing for an own save already deleted', async () => {
      await loadFeed();
      store.create(body);
      const request = http.expectOne({ method: 'POST', url: '/api/payments' });
      const confirmed = payment(20, body.paidAt);

      events.next(deleted(20));
      events.next(saved(confirmed, request.request.headers.get('x-op-id')));

      expect(loadedIds()).toEqual([3, 2, 1]);
    });

    it('keeps newer values when an own update resolves after a newer save', async () => {
      await loadFeed();
      const update = {
        payerMemberId: 1,
        title: 'Mine',
        paidAt: newer.paidAt,
        fullAmount: 1,
        splitType: 'equal' as const,
        participants: [{ memberId: 1, inputValue: 0 }],
      };
      store.update(7, 2, update);
      const request = http.expectOne({ method: 'PUT', url: '/api/payments/2' });

      events.next(saved({ ...newer, title: 'Mine' }, request.request.headers.get('x-op-id')));
      events.next(saved({ ...newer, title: 'Newer' }));
      request.flush({ payment: { ...newer, title: 'Mine' } });

      expect(paymentRows(store.feed(7)()).find((p) => p.id === 2)?.title).toBe('Newer');
    });

    it('shows one repayment in the feed and Done when its event precedes the response', async () => {
      await loadFeed();
      const done = TestBed.inject(DoneStore);
      const added = vi.spyOn(done, 'added');
      store.recordSettlement({ groupId: 7, fromMemberId: 2, toMemberId: 1, amount: 3000 });
      const request = http.expectOne({ method: 'POST', url: '/api/settlements' });
      const confirmed: SettlementResponse = {
        id: 5,
        groupId: 7,
        fromMemberId: 2,
        toMemberId: 1,
        amount: 3000,
        settledAt: '2026-10-28T10:00:00.000Z',
        createdByMemberId: 1,
        createdAt: '2026-10-28T10:00:00.000Z',
      };

      events.next({
        type: 'settlement.saved',
        groupId: 7,
        opId: request.request.headers.get('x-op-id'),
        settlement: confirmed,
      });
      request.flush(confirmed);

      const state = store.feed(7)();
      expect(
        state.status === 'loaded' ? state.rows.filter((r) => r.kind === 'settlement') : [],
      ).toHaveLength(1);
      expect(added).toHaveBeenCalledTimes(1);
    });

    it('keeps an event that arrives during a loadMore', async () => {
      store.loadFirst(7);
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(newest, newer), nextCursor: 'more' });
      await settle();
      store.loadMore();
      await settle();
      const second = http.expectOne('/api/expense-groups/7/feed?cursor=more');

      events.next(saved(payment(10, '2026-10-10T10:00:00.000Z')));
      second.flush({ items: items(older), nextCursor: null });
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed?cursor=more')
        .flush({ items: items(older), nextCursor: null });
      await settle();

      expect(loadedIds()).toEqual([3, 10, 2, 1]);
    });

    it('reloads when the connection resyncs during the first fetch', async () => {
      store.loadFirst(7);
      await settle();

      resynced.next();
      await settle();

      const open = http.match('/api/expense-groups/7/feed').filter((request) => !request.cancelled);
      expect(open).toHaveLength(1);
    });

    it('does not count an event as an own settled mutation', async () => {
      await loadFeed();
      const version = store.settledVersion(7);

      events.next(saved(theirs));

      expect(version()).toBe(0);
    });

    it('shows a repayment from someone else and removes it when undone', async () => {
      await loadFeed();
      const repaid: SettlementResponse = {
        id: 4,
        groupId: 7,
        fromMemberId: 2,
        toMemberId: 1,
        amount: 3000,
        settledAt: '2026-10-06T10:00:00.000Z',
        createdByMemberId: 2,
        createdAt: '2026-10-06T10:00:00.000Z',
      };
      const done = TestBed.inject(DoneStore);
      const added = vi.spyOn(done, 'added');
      const removed = vi.spyOn(done, 'removed');

      events.next({ type: 'settlement.saved', groupId: 7, opId: null, settlement: repaid });
      const rows = () => {
        const state = store.feed(7)();
        return state.status === 'loaded' ? state.rows.filter((r) => r.kind === 'settlement') : [];
      };
      expect(rows()).toHaveLength(1);
      expect(added).toHaveBeenCalledWith(7, repaid);

      events.next({ type: 'settlement.deleted', groupId: 7, opId: null, id: 4 });
      expect(rows()).toHaveLength(0);
      expect(removed).toHaveBeenCalledWith(7, 4);
    });
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

    const loadMixed = async () => {
      store.loadFirst(7);
      await settle();
      http.expectOne('/api/expense-groups/7/feed').flush({
        items: [...items(older, newest), { kind: 'settlement', settlement: repaid }],
        nextCursor: null,
      });
      await settle();
    };

    const settlementRows = () => {
      const state = store.feed(7)();
      return state.status === 'loaded'
        ? state.rows.flatMap((row) =>
            row.kind === 'settlement' ? [{ id: row.settlement.id, pending: row.pending }] : [],
          )
        : [];
    };

    it('sorts settlements among payments by date', async () => {
      await loadMixed();

      const state = store.feed(7)();
      if (state.status !== 'loaded') throw new Error('expected loaded');
      expect(state.rows.map((row) => row.kind)).toEqual(['payment', 'settlement', 'payment']);
    });

    it('recordSettlement shows a pending row then the confirmed one', async () => {
      await loadMixed();

      store.recordSettlement(repayment);
      const [pending] = settlementRows().filter((row) => row.pending);
      expect(pending?.id).toBeLessThan(0);
      expect(store.pendingSettlements(7)()).toEqual([repayment]);

      http.expectOne('/api/settlements').flush(settlement(5, '2026-10-26T10:00:00.000Z'));

      await settle();

      expect(settlementRows()).toEqual([
        { id: 5, pending: false },
        { id: 4, pending: false },
      ]);
      expect(store.pendingSettlements(7)()).toEqual([]);
    });

    it('record failure drops the row and toasts', async () => {
      await loadMixed();

      store.recordSettlement(repayment);
      http.expectOne('/api/settlements').flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(settlementRows()).toEqual([{ id: 4, pending: false }]);
      expect(error).toHaveBeenCalledWith("Couldn't record the repayment");
    });

    it('tells the Done store about a recorded and an undone repayment', async () => {
      const done = TestBed.inject(DoneStore);
      const added = vi.spyOn(done, 'added');
      const hide = vi.spyOn(done, 'hide');
      const removed = vi.spyOn(done, 'removed');
      await loadMixed();

      store.recordSettlement(repayment);
      http.expectOne('/api/settlements').flush(settlement(5, '2026-10-26T10:00:00.000Z'));
      await settle();
      store.undoSettlement(7, 4);
      expect(hide).toHaveBeenCalledWith(4);
      http.expectOne('/api/settlements/4').flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(added).toHaveBeenCalledWith(7, settlement(5, '2026-10-26T10:00:00.000Z'));
      expect(removed).toHaveBeenCalledWith(7, 4);
    });

    it('puts a repayment back in Done when its undo fails', async () => {
      const unhide = vi.spyOn(TestBed.inject(DoneStore), 'unhide');
      await loadMixed();

      store.undoSettlement(7, 4);
      http.expectOne('/api/settlements/4').flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(unhide).toHaveBeenCalledWith(4);
      http.match('/api/expense-groups/7/feed');
    });

    it('undo hides then removes', async () => {
      await loadMixed();

      store.undoSettlement(7, 4);
      expect(settlementRows()).toEqual([]);

      http.expectOne('/api/settlements/4').flush(null, { status: 204, statusText: 'No Content' });

      await settle();
      expect(settlementRows()).toEqual([]);
    });

    it('undo failure restores the row', async () => {
      await loadMixed();

      store.undoSettlement(7, 4);
      http.expectOne('/api/settlements/4').flush(null, { status: 403, statusText: 'Forbidden' });
      await settle();

      expect(settlementRows()).toEqual([{ id: 4, pending: false }]);
      expect(error).toHaveBeenCalledWith("Couldn't undo the repayment");
    });

    it('undo failure refetches Done too, so both lists agree', async () => {
      await loadMixed();

      store.undoSettlement(7, 4);
      http.expectOne('/api/settlements/4').flush(null, { status: 404, statusText: 'Not Found' });
      await settle();

      http.expectOne('/api/expense-groups/7/settlements');
      http.match('/api/expense-groups/7/feed');
    });

    it('undo failure refetches the feed so a repayment undone elsewhere goes away', async () => {
      await loadMixed();

      store.undoSettlement(7, 4);
      http.expectOne('/api/settlements/4').flush(null, { status: 404, statusText: 'Not Found' });
      await settle();
      http
        .expectOne('/api/expense-groups/7/feed')
        .flush({ items: items(older, newest), nextCursor: null });
      await settle();

      expect(settlementRows()).toEqual([]);
    });

    it('undoing a settlement leaves a payment with the same id alone', async () => {
      store.loadFirst(7);
      await settle();
      http.expectOne('/api/expense-groups/7/feed').flush({
        items: [
          ...items(payment(4, '2026-10-01T10:00:00.000Z')),
          { kind: 'settlement', settlement: repaid },
        ],
        nextCursor: null,
      });
      await settle();

      store.undoSettlement(7, 4);

      expect(paymentRows(store.feed(7)()).map((p) => p.id)).toEqual([4]);
    });

    it('counts settled settlement mutations', async () => {
      await loadMixed();
      const version = store.settledVersion(7);

      store.recordSettlement(repayment);
      http.expectOne('/api/settlements').flush(settlement(5, '2026-10-26T10:00:00.000Z'));
      await settle();
      store.undoSettlement(7, 5);
      http.expectOne('/api/settlements/5').flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(version()).toBe(2);
    });
  });
});

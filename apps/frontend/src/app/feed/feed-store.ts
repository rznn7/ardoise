import { computed, inject, Injectable, type Signal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  type CreatePaymentBody,
  type CreateSettlementBody,
  type FeedItem,
  type FeedPage,
  type GroupEvent,
  type PaymentResponse,
  type SettlementResponse,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { defer, type Observable, of, switchMap } from 'rxjs';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { DoneStore } from 'src/app/settlement/done-store';
import { SettlementApiService } from 'src/app/settlement/settlement-api.service';
import { type More, PagedList } from 'src/app/shared/paged-list';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';
import { ToastService } from 'src/app/shared/toast.service';

import { FeedApiService } from './feed-api.service';

export type FeedRow =
  | { readonly kind: 'payment'; readonly payment: PaymentResponse; readonly pending: boolean }
  | {
      readonly kind: 'settlement';
      readonly settlement: SettlementResponse;
      readonly pending: boolean;
    };

export type FeedState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly rows: readonly FeedRow[]; readonly more: More };

interface PendingSettlement {
  readonly body: CreateSettlementBody;
  readonly row: FeedRow;
}

const dateOf = (row: FeedRow): number =>
  Date.parse(row.kind === 'payment' ? row.payment.paidAt : row.settlement.settledAt);

const idOf = (row: FeedRow): number =>
  row.kind === 'payment' ? row.payment.id : row.settlement.id;

const kindRank = (row: FeedRow): number => (row.kind === 'payment' ? 0 : 1);

const newestFirst = (a: FeedRow, b: FeedRow): number =>
  dateOf(b) - dateOf(a) || kindRank(a) - kindRank(b) || idOf(b) - idOf(a);

const keyOf = (item: FeedItem): string =>
  item.kind === 'payment'
    ? `payment:${String(item.payment.id)}`
    : `settlement:${String(item.settlement.id)}`;

const isPayment = (item: FeedItem, id: number): boolean =>
  item.kind === 'payment' && item.payment.id === id;

const isSettlement = (item: FeedItem, id: number): boolean =>
  item.kind === 'settlement' && item.settlement.id === id;

const withoutKey = <V>(map: ReadonlyMap<number, V>, key: number): ReadonlyMap<number, V> => {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
};

const withUpdate = (payment: PaymentResponse, body: UpdatePaymentBody): PaymentResponse => ({
  ...payment,
  payerMemberId: body.payerMemberId,
  title: body.title,
  paidAt: body.paidAt,
  fullAmount: body.fullAmount,
  splitType: body.splitType,
});

@Injectable({ providedIn: 'root' })
export class FeedStore {
  private readonly feedApi = inject(FeedApiService);
  private readonly paymentApi = inject(PaymentApiService);
  private readonly settlementApi = inject(SettlementApiService);
  private readonly toast = inject(ToastService);
  private readonly done = inject(DoneStore);
  private readonly pages = new PagedList<FeedItem>(
    (groupId, cursor) => this.fetchSettled(groupId, cursor),
    keyOf,
  );
  private readonly creating = signal<ReadonlyMap<number, FeedRow>>(new Map());
  private readonly recording = signal<ReadonlyMap<number, PendingSettlement>>(new Map());
  private readonly deleting = signal<ReadonlySet<number>>(new Set());
  private readonly undoing = signal<ReadonlySet<number>>(new Set());
  private readonly updating = signal<ReadonlyMap<number, UpdatePaymentBody>>(new Map());
  private readonly confirmedUpdates = new Map<number, UpdatePaymentBody>();
  private readonly settledMutations = signal<ReadonlyMap<number, number>>(new Map());
  private readonly pendingByOpId = new Map<string, number | null>();
  private readonly appliedOps = new Set<string>();
  private readonly eventCounts = new Map<number, number>();
  private readonly tombstones = new Set<string>();
  private nextTemporaryId = -1;

  constructor() {
    const realtime = inject(RealtimeService);
    realtime.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      this.apply(event);
    });
    realtime.resynced.pipe(takeUntilDestroyed()).subscribe(() => {
      const groupId = this.pages.activeGroupId();
      if (groupId !== null) this.loadFirst(groupId);
    });
  }

  feed(groupId: number): Signal<FeedState> {
    return computed(() => this.feedOf(groupId));
  }

  pendingSettlements(groupId: number): Signal<readonly CreateSettlementBody[]> {
    return computed(() =>
      [...this.recording().values()]
        .map(({ body }) => body)
        .filter((body) => body.groupId === groupId),
    );
  }

  settledVersion(groupId: number): Signal<number> {
    return computed(() => this.settledMutations().get(groupId) ?? 0);
  }

  pendingUpdate(id: number): Signal<UpdatePaymentBody | null> {
    return computed(() => this.updating().get(id) ?? null);
  }

  confirmedUpdate(id: number): UpdatePaymentBody | null {
    return this.confirmedUpdates.get(id) ?? null;
  }

  loadFirst(groupId: number): void {
    this.pages.loadFirst(groupId);
  }

  loadMore(): void {
    this.pages.loadMore();
  }

  retryMore(): void {
    this.pages.retryMore();
  }

  refreshState(groupId: number): Signal<'idle' | 'loading' | 'error'> {
    return computed(() => this.pages.refreshState(groupId));
  }

  hasPages(groupId: number): boolean {
    return this.pages.hasPages(groupId);
  }

  create(body: CreatePaymentBody): void {
    const temporaryId = this.nextTemporaryId--;
    const pendingRow: FeedRow = {
      kind: 'payment',
      pending: true,
      payment: {
        id: temporaryId,
        groupId: body.groupId,
        payerMemberId: body.payerMemberId,
        title: body.title,
        paidAt: body.paidAt,
        fullAmount: body.fullAmount,
        splitType: body.splitType,
        createdAt: new Date().toISOString(),
      },
    };
    const opId = crypto.randomUUID();
    this.pendingByOpId.set(opId, temporaryId);
    this.creating.update((rows) => new Map(rows).set(temporaryId, pendingRow));
    const settle = (): void => {
      this.forgetOp(opId);
      this.creating.update((rows) => {
        const next = new Map(rows);
        next.delete(temporaryId);
        return next;
      });
      this.markSettled(body.groupId);
    };

    this.paymentApi.create(body, opId).subscribe({
      next: ({ payment }) => {
        this.acceptOwn(body.groupId, opId, { kind: 'payment', payment });
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't save the payment");
      },
    });
  }

  update(groupId: number, id: number, body: UpdatePaymentBody): void {
    const opId = crypto.randomUUID();
    this.pendingByOpId.set(opId, null);
    this.updating.update((updates) => new Map(updates).set(id, body));
    const settle = (): void => {
      this.forgetOp(opId);
      this.updating.update((updates) => {
        if (updates.get(id) !== body) return updates;
        const next = new Map(updates);
        next.delete(id);
        return next;
      });
      this.markSettled(groupId);
    };

    this.paymentApi.update(id, body, opId).subscribe({
      next: ({ payment }) => {
        this.confirmedUpdates.set(id, body);
        this.acceptOwn(groupId, opId, { kind: 'payment', payment });
        settle();
      },
      error: () => {
        this.confirmedUpdates.delete(id);
        settle();
        this.toast.error("Couldn't update the payment");
      },
    });
  }

  remove(groupId: number, id: number): void {
    this.deleting.update((ids) => new Set(ids).add(id));
    const settle = (): void => {
      this.deleting.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      this.markSettled(groupId);
    };

    this.paymentApi.delete(id, crypto.randomUUID()).subscribe({
      next: () => {
        this.tombstones.add(`payment:${String(id)}`);
        this.pages.patch(groupId, (items) => items.filter((item) => !isPayment(item, id)));
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't delete the payment");
      },
    });
  }

  recordSettlement(body: CreateSettlementBody): void {
    const temporaryId = this.nextTemporaryId--;
    const now = new Date().toISOString();
    const row: FeedRow = {
      kind: 'settlement',
      pending: true,
      settlement: {
        id: temporaryId,
        groupId: body.groupId,
        fromMemberId: body.fromMemberId,
        toMemberId: body.toMemberId,
        amount: body.amount,
        settledAt: now,
        createdByMemberId: 0,
        createdAt: now,
      },
    };
    const opId = crypto.randomUUID();
    this.pendingByOpId.set(opId, temporaryId);
    this.recording.update((pending) => new Map(pending).set(temporaryId, { body, row }));
    const settle = (): void => {
      this.forgetOp(opId);
      this.recording.update((pending) => {
        const next = new Map(pending);
        next.delete(temporaryId);
        return next;
      });
      this.markSettled(body.groupId);
    };

    this.settlementApi.create(body, opId).subscribe({
      next: (settlement) => {
        this.acceptOwn(body.groupId, opId, { kind: 'settlement', settlement });
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't record the repayment");
      },
    });
  }

  undoSettlement(groupId: number, id: number): void {
    this.undoing.update((ids) => new Set(ids).add(id));
    this.done.hide(id);
    const settle = (): void => {
      this.undoing.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      this.markSettled(groupId);
    };

    this.settlementApi.delete(id, crypto.randomUUID()).subscribe({
      next: () => {
        this.tombstones.add(`settlement:${String(id)}`);
        this.pages.patch(groupId, (items) => items.filter((item) => !isSettlement(item, id)));
        this.done.removed(groupId, id);
        settle();
      },
      error: () => {
        this.done.unhide(id);
        settle();
        this.toast.error("Couldn't undo the repayment");
        this.loadFirst(groupId);
        this.done.loadFirst(groupId);
      },
    });
  }

  private feedOf(groupId: number): FeedState {
    const state = this.pages.state(groupId);
    if (state.status !== 'loaded') return state;
    const boundary = state.boundary;
    const deleting = this.deleting();
    const undoing = this.undoing();
    const updating = this.updating();
    const rows = state.items.flatMap((item): FeedRow[] => {
      if (item.kind === 'settlement') {
        return undoing.has(item.settlement.id) ? [] : [{ ...item, pending: false }];
      }
      if (deleting.has(item.payment.id)) return [];
      const update = updating.get(item.payment.id);
      const payment = update ? withUpdate(item.payment, update) : item.payment;
      return [{ kind: 'payment', payment, pending: false }];
    });
    const pending = [
      ...this.creating().values(),
      ...[...this.recording().values()].map(({ row }) => row),
    ].filter((row) => (row.kind === 'payment' ? row.payment : row.settlement).groupId === groupId);
    return {
      status: 'loaded',
      more: state.more,
      rows: [...rows, ...pending]
        .filter((row) => !boundary || newestFirst(row, { ...boundary, pending: false }) <= 0)
        .sort(newestFirst),
    };
  }

  private apply(event: GroupEvent): void {
    switch (event.type) {
      case 'payment.saved':
        this.applySaved(event.groupId, event.opId, { kind: 'payment', payment: event.payment });
        break;
      case 'settlement.saved':
        this.applySaved(event.groupId, event.opId, {
          kind: 'settlement',
          settlement: event.settlement,
        });
        break;
      case 'payment.deleted':
        this.tombstones.add(`payment:${String(event.id)}`);
        this.pages.patch(event.groupId, (items) =>
          items.filter((item) => !isPayment(item, event.id)),
        );
        this.markEvent(event.groupId);
        break;
      case 'settlement.deleted':
        this.tombstones.add(`settlement:${String(event.id)}`);
        this.pages.patch(event.groupId, (items) =>
          items.filter((item) => !isSettlement(item, event.id)),
        );
        this.done.removed(event.groupId, event.id);
        this.markEvent(event.groupId);
        break;
      default:
        break;
    }
  }

  private applySaved(groupId: number, opId: string | null, item: FeedItem): void {
    if (opId !== null && this.pendingByOpId.has(opId)) {
      this.appliedOps.add(opId);
      const temporaryId = this.pendingByOpId.get(opId);
      if (temporaryId !== undefined && temporaryId !== null) this.dropPending(temporaryId);
    }
    this.put(groupId, item);
    this.markEvent(groupId);
  }

  private acceptOwn(groupId: number, opId: string, item: FeedItem): void {
    if (this.appliedOps.has(opId)) return;
    this.put(groupId, item);
  }

  private put(groupId: number, item: FeedItem): void {
    if (this.tombstones.has(keyOf(item))) return;
    this.upsert(groupId, item);
    if (item.kind === 'settlement') this.done.added(groupId, item.settlement);
  }

  private forgetOp(opId: string): void {
    this.pendingByOpId.delete(opId);
    this.appliedOps.delete(opId);
  }

  private dropPending(temporaryId: number): void {
    this.creating.update((rows) => withoutKey(rows, temporaryId));
    this.recording.update((rows) => withoutKey(rows, temporaryId));
  }

  private upsert(groupId: number, item: FeedItem): void {
    const id = item.kind === 'payment' ? item.payment.id : item.settlement.id;
    const same = item.kind === 'payment' ? isPayment : isSettlement;
    this.pages.patch(groupId, (items) => [...items.filter((it) => !same(it, id)), item]);
  }

  private fetchSettled(groupId: number, cursor?: string): Observable<FeedPage> {
    return defer(() => {
      const settledBefore = this.settledCount(groupId);
      return this.feedApi
        .listByGroup(groupId, cursor)
        .pipe(
          switchMap((page) =>
            this.settledCount(groupId) === settledBefore
              ? of(page)
              : this.fetchSettled(groupId, cursor),
          ),
        );
    });
  }

  private settledCount(groupId: number): number {
    return untracked(
      () => (this.settledMutations().get(groupId) ?? 0) + (this.eventCounts.get(groupId) ?? 0),
    );
  }

  private markEvent(groupId: number): void {
    this.eventCounts.set(groupId, (this.eventCounts.get(groupId) ?? 0) + 1);
  }

  private markSettled(groupId: number): void {
    this.settledMutations.update((counts) =>
      new Map(counts).set(groupId, (counts.get(groupId) ?? 0) + 1),
    );
  }
}

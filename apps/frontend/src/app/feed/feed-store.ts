import { computed, inject, Injectable, type Signal, signal, untracked } from '@angular/core';
import {
  type CreatePaymentBody,
  type CreateSettlementBody,
  type FeedItem,
  type PaymentResponse,
  type SettlementResponse,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { SettlementApiService } from 'src/app/settlement/settlement-api.service';
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
  | { readonly status: 'loaded'; readonly rows: readonly FeedRow[] };

type FetchedState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly items: readonly FeedItem[] };

interface PendingSettlement {
  readonly body: CreateSettlementBody;
  readonly row: FeedRow;
}

const LOADING: FetchedState = { status: 'loading' };

const dateOf = (row: FeedRow): number =>
  Date.parse(row.kind === 'payment' ? row.payment.paidAt : row.settlement.settledAt);

const idOf = (row: FeedRow): number =>
  row.kind === 'payment' ? row.payment.id : row.settlement.id;

const kindRank = (row: FeedRow): number => (row.kind === 'payment' ? 0 : 1);

const newestFirst = (a: FeedRow, b: FeedRow): number =>
  dateOf(b) - dateOf(a) || kindRank(a) - kindRank(b) || idOf(b) - idOf(a);

const isPayment = (item: FeedItem, id: number): boolean =>
  item.kind === 'payment' && item.payment.id === id;

const isSettlement = (item: FeedItem, id: number): boolean =>
  item.kind === 'settlement' && item.settlement.id === id;

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
  private readonly fetched = signal<ReadonlyMap<number, FetchedState>>(new Map());
  private readonly creating = signal<ReadonlyMap<number, FeedRow>>(new Map());
  private readonly recording = signal<ReadonlyMap<number, PendingSettlement>>(new Map());
  private readonly deleting = signal<ReadonlySet<number>>(new Set());
  private readonly undoing = signal<ReadonlySet<number>>(new Set());
  private readonly updating = signal<ReadonlyMap<number, UpdatePaymentBody>>(new Map());
  private readonly confirmedUpdates = new Map<number, UpdatePaymentBody>();
  private readonly settledMutations = signal<ReadonlyMap<number, number>>(new Map());
  private readonly latestLoads = new Map<number, number>();
  private nextTemporaryId = -1;
  private nextLoadId = 1;

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

  load(groupId: number): void {
    const loadId = this.nextLoadId++;
    this.latestLoads.set(groupId, loadId);
    const settledBefore = this.settledCount(groupId);
    const isLatest = (): boolean => this.latestLoads.get(groupId) === loadId;
    if (this.fetched().get(groupId)?.status !== 'loaded') this.setFetched(groupId, LOADING);

    this.feedApi.listByGroup(groupId).subscribe({
      next: (items) => {
        if (!isLatest()) return;
        if (this.settledCount(groupId) !== settledBefore) {
          this.load(groupId);
          return;
        }
        this.setFetched(groupId, { status: 'loaded', items });
      },
      error: () => {
        if (!isLatest() || this.fetched().get(groupId)?.status === 'loaded') return;
        this.setFetched(groupId, { status: 'error' });
      },
    });
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
    this.creating.update((rows) => new Map(rows).set(temporaryId, pendingRow));
    const settle = (): void => {
      this.creating.update((rows) => {
        const next = new Map(rows);
        next.delete(temporaryId);
        return next;
      });
      this.markSettled(body.groupId);
    };

    this.paymentApi.create(body).subscribe({
      next: ({ payment }) => {
        this.upsert(body.groupId, { kind: 'payment', payment });
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't save the payment");
      },
    });
  }

  update(groupId: number, id: number, body: UpdatePaymentBody): void {
    this.updating.update((updates) => new Map(updates).set(id, body));
    const settle = (): void => {
      this.updating.update((updates) => {
        if (updates.get(id) !== body) return updates;
        const next = new Map(updates);
        next.delete(id);
        return next;
      });
      this.markSettled(groupId);
    };

    this.paymentApi.update(id, body).subscribe({
      next: ({ payment }) => {
        this.confirmedUpdates.set(id, body);
        this.upsert(groupId, { kind: 'payment', payment });
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

    this.paymentApi.delete(id).subscribe({
      next: () => {
        this.changeFetched(groupId, (items) => items.filter((item) => !isPayment(item, id)));
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
    this.recording.update((pending) => new Map(pending).set(temporaryId, { body, row }));
    const settle = (): void => {
      this.recording.update((pending) => {
        const next = new Map(pending);
        next.delete(temporaryId);
        return next;
      });
      this.markSettled(body.groupId);
    };

    this.settlementApi.create(body).subscribe({
      next: (settlement) => {
        this.upsert(body.groupId, { kind: 'settlement', settlement });
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
    const settle = (): void => {
      this.undoing.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      this.markSettled(groupId);
    };

    this.settlementApi.delete(id).subscribe({
      next: () => {
        this.changeFetched(groupId, (items) => items.filter((item) => !isSettlement(item, id)));
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't undo the repayment");
      },
    });
  }

  private feedOf(groupId: number): FeedState {
    const state = this.fetched().get(groupId) ?? LOADING;
    if (state.status !== 'loaded') return state;
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
    return { status: 'loaded', rows: [...rows, ...pending].sort(newestFirst) };
  }

  private upsert(groupId: number, item: FeedItem): void {
    const id = item.kind === 'payment' ? item.payment.id : item.settlement.id;
    const same = item.kind === 'payment' ? isPayment : isSettlement;
    this.changeFetched(groupId, (items) => [...items.filter((it) => !same(it, id)), item]);
  }

  private changeFetched(
    groupId: number,
    change: (items: readonly FeedItem[]) => readonly FeedItem[],
  ): void {
    const state = this.fetched().get(groupId);
    if (state?.status !== 'loaded') return;
    this.setFetched(groupId, { status: 'loaded', items: change(state.items) });
  }

  private settledCount(groupId: number): number {
    return untracked(() => this.settledMutations().get(groupId) ?? 0);
  }

  private markSettled(groupId: number): void {
    this.settledMutations.update((counts) =>
      new Map(counts).set(groupId, (counts.get(groupId) ?? 0) + 1),
    );
  }

  private setFetched(groupId: number, state: FetchedState): void {
    this.fetched.update((states) => new Map(states).set(groupId, state));
  }
}

import { computed, inject, Injectable, type Signal, signal, untracked } from '@angular/core';
import {
  type CreatePaymentBody,
  type PaymentResponse,
  type UpdatePaymentBody,
} from '@ardoise/shared';
import { ToastService } from 'src/app/shared/toast.service';

import { PaymentApiService } from './payment-api.service';

export type FeedPayment = PaymentResponse & { readonly pending: boolean };

export type FeedState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly payments: readonly FeedPayment[] };

type FetchedState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly payments: readonly PaymentResponse[] };

const LOADING: FetchedState = { status: 'loading' };

const newestFirst = (a: PaymentResponse, b: PaymentResponse): number =>
  Date.parse(b.paidAt) - Date.parse(a.paidAt) || b.id - a.id;

const confirmed = (payment: PaymentResponse): FeedPayment => ({ ...payment, pending: false });

const withUpdate = (payment: PaymentResponse, body: UpdatePaymentBody): FeedPayment => ({
  ...payment,
  payerMemberId: body.payerMemberId,
  title: body.title,
  paidAt: body.paidAt,
  fullAmount: body.fullAmount,
  splitType: body.splitType,
  pending: false,
});

@Injectable({ providedIn: 'root' })
export class PaymentStore {
  private readonly api = inject(PaymentApiService);
  private readonly toast = inject(ToastService);
  private readonly fetched = signal<ReadonlyMap<number, FetchedState>>(new Map());
  private readonly creating = signal<ReadonlyMap<number, FeedPayment>>(new Map());
  private readonly deleting = signal<ReadonlySet<number>>(new Set());
  private readonly updating = signal<ReadonlyMap<number, UpdatePaymentBody>>(new Map());
  private readonly confirmedUpdates = new Map<number, UpdatePaymentBody>();
  private readonly settledMutations = signal<ReadonlyMap<number, number>>(new Map());
  private readonly latestLoads = new Map<number, number>();
  private nextTemporaryId = -1;
  private nextLoadId = 1;

  feed(groupId: number): Signal<FeedState> {
    return computed(() => this.feedOf(groupId));
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

    this.api.listByGroup(groupId).subscribe({
      next: (payments) => {
        if (!isLatest()) return;
        if (this.settledCount(groupId) !== settledBefore) {
          this.load(groupId);
          return;
        }
        this.setFetched(groupId, { status: 'loaded', payments });
      },
      error: () => {
        if (!isLatest() || this.fetched().get(groupId)?.status === 'loaded') return;
        this.setFetched(groupId, { status: 'error' });
      },
    });
  }

  create(body: CreatePaymentBody): void {
    const temporaryId = this.nextTemporaryId--;
    const pendingRow: FeedPayment = {
      id: temporaryId,
      groupId: body.groupId,
      payerMemberId: body.payerMemberId,
      title: body.title,
      paidAt: body.paidAt,
      fullAmount: body.fullAmount,
      splitType: body.splitType,
      createdAt: new Date().toISOString(),
      pending: true,
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

    this.api.create(body).subscribe({
      next: ({ payment }) => {
        this.upsert(body.groupId, payment);
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

    this.api.update(id, body).subscribe({
      next: ({ payment }) => {
        this.confirmedUpdates.set(id, body);
        this.upsert(groupId, payment);
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

    this.api.delete(id).subscribe({
      next: () => {
        this.changeFetched(groupId, (rows) => rows.filter((row) => row.id !== id));
        settle();
      },
      error: () => {
        settle();
        this.toast.error("Couldn't delete the payment");
      },
    });
  }

  private feedOf(groupId: number): FeedState {
    const state = this.fetched().get(groupId) ?? LOADING;
    if (state.status !== 'loaded') return state;
    const deleting = this.deleting();
    const updating = this.updating();
    const rows = state.payments
      .filter((payment) => !deleting.has(payment.id))
      .map((payment) => {
        const update = updating.get(payment.id);
        return update ? withUpdate(payment, update) : confirmed(payment);
      });
    const created = [...this.creating().values()].filter((row) => row.groupId === groupId);
    return { status: 'loaded', payments: [...rows, ...created].sort(newestFirst) };
  }

  private upsert(groupId: number, payment: PaymentResponse): void {
    this.changeFetched(groupId, (rows) => [
      ...rows.filter((row) => row.id !== payment.id),
      payment,
    ]);
  }

  private changeFetched(
    groupId: number,
    change: (rows: readonly PaymentResponse[]) => readonly PaymentResponse[],
  ): void {
    const state = this.fetched().get(groupId);
    if (state?.status !== 'loaded') return;
    this.setFetched(groupId, { status: 'loaded', payments: change(state.payments) });
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

import { computed, inject, Injectable, type Signal, signal } from '@angular/core';
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

const LOADING: FeedState = { status: 'loading' };

const newestFirst = (a: PaymentResponse, b: PaymentResponse): number =>
  Date.parse(b.paidAt) - Date.parse(a.paidAt) || b.id - a.id;

const confirmed = (payment: PaymentResponse): FeedPayment => ({ ...payment, pending: false });

@Injectable({ providedIn: 'root' })
export class PaymentStore {
  private readonly api = inject(PaymentApiService);
  private readonly toast = inject(ToastService);
  private readonly feeds = signal<ReadonlyMap<number, FeedState>>(new Map());
  private nextTemporaryId = -1;

  feed(groupId: number): Signal<FeedState> {
    return computed(() => this.feeds().get(groupId) ?? LOADING);
  }

  load(groupId: number): void {
    this.setFeed(groupId, LOADING);
    this.api.listByGroup(groupId).subscribe({
      next: (payments) => {
        this.setPayments(groupId, payments.map(confirmed));
      },
      error: () => {
        this.setFeed(groupId, { status: 'error' });
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
    this.changePayments(body.groupId, (rows) => [...rows, pendingRow]);

    this.api.create(body).subscribe({
      next: ({ payment }) => {
        this.changePayments(body.groupId, (rows) =>
          rows.map((row) => (row.id === temporaryId ? confirmed(payment) : row)),
        );
      },
      error: () => {
        this.changePayments(body.groupId, (rows) => rows.filter((row) => row.id !== temporaryId));
        this.toast.error("Couldn't save the payment");
      },
    });
  }

  update(groupId: number, id: number, body: UpdatePaymentBody): void {
    const state = this.feeds().get(groupId);
    const previous = state?.status === 'loaded' ? state.payments : undefined;
    if (previous) {
      this.setPayments(
        groupId,
        previous.map((row) =>
          row.id === id
            ? {
                ...row,
                payerMemberId: body.payerMemberId,
                title: body.title,
                paidAt: body.paidAt,
                fullAmount: body.fullAmount,
                splitType: body.splitType,
              }
            : row,
        ),
      );
    }

    this.api.update(id, body).subscribe({
      next: ({ payment }) => {
        this.changePayments(groupId, (rows) =>
          rows.map((row) => (row.id === id ? confirmed(payment) : row)),
        );
      },
      error: () => {
        if (previous) this.setPayments(groupId, previous);
        this.toast.error("Couldn't update the payment");
      },
    });
  }

  remove(groupId: number, id: number): void {
    const state = this.feeds().get(groupId);
    if (state?.status !== 'loaded') return;
    const previous = state.payments;
    this.setPayments(
      groupId,
      previous.filter((row) => row.id !== id),
    );

    this.api.delete(id).subscribe({
      error: () => {
        this.setPayments(groupId, previous);
        this.toast.error("Couldn't delete the payment");
      },
    });
  }

  private changePayments(
    groupId: number,
    change: (rows: readonly FeedPayment[]) => readonly FeedPayment[],
  ): void {
    const state = this.feeds().get(groupId);
    if (state?.status !== 'loaded') return;
    this.setPayments(groupId, change(state.payments));
  }

  private setPayments(groupId: number, payments: readonly FeedPayment[]): void {
    this.setFeed(groupId, { status: 'loaded', payments: [...payments].sort(newestFirst) });
  }

  private setFeed(groupId: number, state: FeedState): void {
    this.feeds.update((feeds) => new Map(feeds).set(groupId, state));
  }
}

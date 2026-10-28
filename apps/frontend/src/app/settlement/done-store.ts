import { computed, inject, Injectable, type Signal, signal } from '@angular/core';
import { type SettlementResponse } from '@ardoise/shared';
import { type More, PagedList } from 'src/app/shared/paged-list';
import { RealtimeService } from 'src/app/shared/realtime/realtime.service';

import { SettlementApiService } from './settlement-api.service';

export type DoneState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'loaded';
      readonly settlements: readonly SettlementResponse[];
      readonly more: More;
    };

const newestFirst = (a: SettlementResponse, b: SettlementResponse): number =>
  Date.parse(b.settledAt) - Date.parse(a.settledAt) || b.id - a.id;

@Injectable({ providedIn: 'root' })
export class DoneStore {
  private readonly api = inject(SettlementApiService);
  private readonly pages = new PagedList<SettlementResponse>(
    (groupId, cursor) => this.api.listByGroup(groupId, cursor),
    (settlement) => String(settlement.id),
  );
  private readonly hidden = signal<ReadonlySet<number>>(new Set());

  constructor() {
    inject(RealtimeService).resynced.subscribe(() => {
      const groupId = this.pages.keptGroupId();
      if (groupId !== null) this.loadFirst(groupId);
    });
  }

  done(groupId: number): Signal<DoneState> {
    return computed(() => {
      const state = this.pages.state(groupId);
      if (state.status !== 'loaded') return state;
      const hidden = this.hidden();
      const boundary = state.boundary;
      return {
        status: 'loaded',
        more: state.more,
        settlements: state.items
          .filter((settlement) => !hidden.has(settlement.id))
          .filter((settlement) => !boundary || newestFirst(settlement, boundary) <= 0)
          .sort(newestFirst),
      };
    });
  }

  refreshState(groupId: number): Signal<'idle' | 'loading' | 'error'> {
    return computed(() => this.pages.refreshState(groupId));
  }

  hasPages(groupId: number): boolean {
    return this.pages.hasPages(groupId);
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

  added(groupId: number, settlement: SettlementResponse): void {
    this.pages.patch(groupId, (items) => [
      settlement,
      ...items.filter((item) => item.id !== settlement.id),
    ]);
  }

  removed(groupId: number, id: number): void {
    this.pages.patch(groupId, (items) => items.filter((item) => item.id !== id));
    this.unhide(id);
  }

  hide(id: number): void {
    this.hidden.update((ids) => new Set(ids).add(id));
  }

  unhide(id: number): void {
    this.hidden.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }
}

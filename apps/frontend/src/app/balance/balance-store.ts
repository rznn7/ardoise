import { computed, inject, Injectable, type Signal, signal } from '@angular/core';
import { type GroupBalancesResponse } from '@ardoise/shared';

import { BalanceApiService } from './balance-api.service';

export type BalancesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'loaded'; readonly balances: GroupBalancesResponse };

const LOADING: BalancesState = { status: 'loading' };

@Injectable({ providedIn: 'root' })
export class BalanceStore {
  private readonly api = inject(BalanceApiService);
  private readonly states = signal<ReadonlyMap<number, BalancesState>>(new Map());
  private readonly reloading = signal<ReadonlySet<number>>(new Set());
  private readonly latestLoads = new Map<number, number>();
  private nextLoadId = 1;

  balances(groupId: number): Signal<BalancesState> {
    return computed(() => this.states().get(groupId) ?? LOADING);
  }

  refreshing(groupId: number): Signal<boolean> {
    return computed(() => this.reloading().has(groupId));
  }

  load(groupId: number): void {
    const loadId = this.nextLoadId++;
    this.latestLoads.set(groupId, loadId);
    const isLatest = (): boolean => this.latestLoads.get(groupId) === loadId;
    const hasLoaded = (): boolean => this.states().get(groupId)?.status === 'loaded';
    if (hasLoaded()) this.markReloading(groupId, true);
    else this.set(groupId, LOADING);

    this.api.listByGroup(groupId).subscribe({
      next: (balances) => {
        if (!isLatest()) return;
        this.set(groupId, { status: 'loaded', balances });
        this.markReloading(groupId, false);
      },
      error: () => {
        if (!isLatest()) return;
        if (!hasLoaded()) this.set(groupId, { status: 'error' });
        this.markReloading(groupId, false);
      },
    });
  }

  private markReloading(groupId: number, reloading: boolean): void {
    this.reloading.update((ids) => {
      const next = new Set(ids);
      if (reloading) next.add(groupId);
      else next.delete(groupId);
      return next;
    });
  }

  private set(groupId: number, state: BalancesState): void {
    this.states.update((states) => new Map(states).set(groupId, state));
  }
}

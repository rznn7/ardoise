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
  private readonly latestLoads = new Map<number, number>();
  private nextLoadId = 1;

  balances(groupId: number): Signal<BalancesState> {
    return computed(() => this.states().get(groupId) ?? LOADING);
  }

  load(groupId: number): void {
    const loadId = this.nextLoadId++;
    this.latestLoads.set(groupId, loadId);
    const isLatest = (): boolean => this.latestLoads.get(groupId) === loadId;
    const hasLoaded = (): boolean => this.states().get(groupId)?.status === 'loaded';
    if (!hasLoaded()) this.set(groupId, LOADING);

    this.api.listByGroup(groupId).subscribe({
      next: (balances) => {
        if (isLatest()) this.set(groupId, { status: 'loaded', balances });
      },
      error: () => {
        if (isLatest() && !hasLoaded()) this.set(groupId, { status: 'error' });
      },
    });
  }

  private set(groupId: number, state: BalancesState): void {
    this.states.update((states) => new Map(states).set(groupId, state));
  }
}

import { Injectable } from '@angular/core';
import { type ExpenseGroupSummary, type GroupMember, type MeResponse } from '@ardoise/shared';

export interface GroupVisit {
  readonly group: ExpenseGroupSummary;
  readonly members: readonly GroupMember[];
  readonly me: MeResponse;
  readonly scrollTop: number;
  readonly settledVersion: number;
}

export const isReturnFromChild = (previousUrl: string | undefined, groupId: number): boolean =>
  previousUrl?.startsWith(`/group/${String(groupId)}/`) ?? false;

@Injectable({ providedIn: 'root' })
export class GroupVisitMemory {
  private readonly visits = new Map<number, GroupVisit>();

  remember(groupId: number, visit: GroupVisit): void {
    this.visits.set(groupId, visit);
  }

  recall(groupId: number): GroupVisit | undefined {
    return this.visits.get(groupId);
  }
}

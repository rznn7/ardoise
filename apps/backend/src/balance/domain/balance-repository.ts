import { type MemberTotals } from './balance';

export const BALANCE_REPOSITORY = Symbol('BALANCE_REPOSITORY');

export interface BalanceRepository {
  totalsByGroup(groupId: number): Promise<MemberTotals[]>;
}

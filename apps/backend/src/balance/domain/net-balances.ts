import {
  type MemberBalance,
  type MemberTotals,
  UnbalancedLedger,
} from './balance';

export const netOf = (totals: MemberTotals): number =>
  totals.paid - totals.owed + totals.settledOut - totals.settledIn;

export function netBalances(totals: readonly MemberTotals[]): MemberBalance[] {
  const balances = totals.map((member) => ({
    memberId: member.memberId,
    amount: netOf(member),
  }));
  const sum = balances.reduce((total, { amount }) => total + amount, 0);
  if (sum !== 0) throw new UnbalancedLedger();
  return balances;
}

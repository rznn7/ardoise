import { type MemberBalance, type Transfer } from './balance';

type Position = { memberId: number; amount: number };

const largestFirst = (a: Position, b: Position): number =>
  b.amount - a.amount || a.memberId - b.memberId;

export function simplifyDebts(balances: readonly MemberBalance[]): Transfer[] {
  const creditors: Position[] = balances
    .filter(({ amount }) => amount > 0)
    .map(({ memberId, amount }) => ({ memberId, amount }));
  const debtors: Position[] = balances
    .filter(({ amount }) => amount < 0)
    .map(({ memberId, amount }) => ({ memberId, amount: -amount }));
  const transfers: Transfer[] = [];

  for (;;) {
    const [debtor] = debtors.sort(largestFirst);
    const [creditor] = creditors.sort(largestFirst);
    if (!debtor || !creditor) return transfers;

    const amount = Math.min(debtor.amount, creditor.amount);
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amount,
    });
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtors.shift();
    if (creditor.amount === 0) creditors.shift();
  }
}

import {
  type GroupMember,
  type MemberBalanceResponse,
  type TransferResponse,
} from '@ardoise/shared';

export interface MemberRow {
  readonly memberId: number;
  readonly name: string;
  readonly amount: number;
  readonly ratio: number;
  readonly isMe: boolean;
}

export interface RepaymentRow {
  readonly label: string;
  readonly amount: number;
  readonly mine: boolean;
}

const myMemberId = (members: readonly GroupMember[], meUserId: number): number | undefined =>
  members.find((member) => member.userId === meUserId)?.id;

const nameOf = (members: readonly GroupMember[], memberId: number): string =>
  members.find((member) => member.id === memberId)?.name ?? 'Someone';

export function memberRows(
  balances: readonly MemberBalanceResponse[],
  members: readonly GroupMember[],
  meUserId: number,
): MemberRow[] {
  const me = myMemberId(members, meUserId);
  const largest = Math.max(0, ...balances.map(({ amount }) => Math.abs(amount)));
  return balances
    .map(({ memberId, amount }) => ({
      memberId,
      amount,
      name: memberId === me ? 'You' : nameOf(members, memberId),
      ratio: largest === 0 ? 0 : amount / largest,
      isMe: memberId === me,
    }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

export function repaymentRows(
  transfers: readonly TransferResponse[],
  members: readonly GroupMember[],
  meUserId: number,
): RepaymentRow[] {
  const me = myMemberId(members, meUserId);
  return transfers
    .map(({ fromMemberId, toMemberId, amount }) => {
      const from = nameOf(members, fromMemberId);
      const to = nameOf(members, toMemberId);
      if (fromMemberId === me) return { label: `You pay ${to}`, amount, mine: true };
      if (toMemberId === me) return { label: `${from} pays you`, amount, mine: true };
      return { label: `${from} pays ${to}`, amount, mine: false };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.amount - a.amount);
}

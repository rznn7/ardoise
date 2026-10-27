import {
  type CreateSettlementBody,
  type GroupMember,
  type MemberBalanceResponse,
  type SettlementResponse,
  type TransferResponse,
} from '@ardoise/shared';
import { settlementLabel } from 'src/app/settlement/settlement-label';

export interface MemberRow {
  readonly memberId: number;
  readonly name: string;
  readonly amount: number;
  readonly ratio: number;
  readonly isMe: boolean;
}

export interface RepaymentRow {
  readonly fromMemberId: number;
  readonly toMemberId: number;
  readonly label: string;
  readonly confirmLabel: string | null;
  readonly amount: number;
  readonly mine: boolean;
  readonly pending: boolean;
}

export interface DoneRow {
  readonly id: number;
  readonly label: string;
  readonly settledAt: string;
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
  pending: readonly CreateSettlementBody[],
): RepaymentRow[] {
  const me = myMemberId(members, meUserId);
  const isPending = (transfer: TransferResponse): boolean =>
    pending.some(
      (body) =>
        body.fromMemberId === transfer.fromMemberId &&
        body.toMemberId === transfer.toMemberId &&
        body.amount === transfer.amount,
    );
  return transfers
    .map((transfer) => {
      const { fromMemberId, toMemberId, amount } = transfer;
      const from = nameOf(members, fromMemberId);
      const to = nameOf(members, toMemberId);
      const base = { fromMemberId, toMemberId, amount, pending: isPending(transfer) };
      if (fromMemberId === me)
        return { ...base, label: `You pay ${to}`, confirmLabel: `I paid ${to} back`, mine: true };
      if (toMemberId === me)
        return {
          ...base,
          label: `${from} pays you`,
          confirmLabel: `${from} paid me back`,
          mine: true,
        };
      return { ...base, label: `${from} pays ${to}`, confirmLabel: null, mine: false };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.amount - a.amount);
}

export function doneRows(
  settlements: readonly SettlementResponse[],
  members: readonly GroupMember[],
  meUserId: number,
): DoneRow[] {
  const me = myMemberId(members, meUserId);
  return settlements
    .map((settlement) => ({
      id: settlement.id,
      label: settlementLabel(settlement, members, meUserId),
      settledAt: settlement.settledAt,
      amount: settlement.amount,
      mine: settlement.fromMemberId === me || settlement.toMemberId === me,
    }))
    .sort((a, b) => Date.parse(b.settledAt) - Date.parse(a.settledAt) || b.id - a.id);
}

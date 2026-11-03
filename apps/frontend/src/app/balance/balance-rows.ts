import {
  type CreateSettlementBody,
  type GroupMember,
  type MemberBalanceResponse,
  type SettlementResponse,
  type TransferResponse,
} from '@ardoise/shared';
import { marker } from '@jsverse/transloco-keys-manager/marker';
import { settlementLabel } from 'src/app/settlement/settlement-label';
import { type Translator } from 'src/app/shared/i18n/translation-key';

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

const nameOf = (members: readonly GroupMember[], memberId: number, tr: Translator): string =>
  members.find((member) => member.id === memberId)?.name ?? tr.translate(marker('common.someone'));

export function memberRows(
  balances: readonly MemberBalanceResponse[],
  members: readonly GroupMember[],
  meUserId: number,
  tr: Translator,
): MemberRow[] {
  const me = myMemberId(members, meUserId);
  const largest = Math.max(0, ...balances.map(({ amount }) => Math.abs(amount)));
  return balances
    .map(({ memberId, amount }) => ({
      memberId,
      amount,
      name: memberId === me ? tr.translate(marker('common.you')) : nameOf(members, memberId, tr),
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
  tr: Translator,
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
      const from = nameOf(members, fromMemberId, tr);
      const to = nameOf(members, toMemberId, tr);
      const base = { fromMemberId, toMemberId, amount, pending: isPending(transfer) };
      if (fromMemberId === me)
        return {
          ...base,
          label: tr.translate(marker('balance.rows.youPay'), { name: to }),
          confirmLabel: tr.translate(marker('balance.rows.iPaid'), { name: to }),
          mine: true,
        };
      if (toMemberId === me)
        return {
          ...base,
          label: tr.translate(marker('balance.rows.paysYou'), { name: from }),
          confirmLabel: tr.translate(marker('balance.rows.paidMe'), { name: from }),
          mine: true,
        };
      return {
        ...base,
        label: tr.translate(marker('balance.rows.pays'), { from, to }),
        confirmLabel: null,
        mine: false,
      };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.amount - a.amount);
}

export function doneRows(
  settlements: readonly SettlementResponse[],
  members: readonly GroupMember[],
  meUserId: number,
  tr: Translator,
): DoneRow[] {
  const me = myMemberId(members, meUserId);
  return settlements
    .map((settlement) => ({
      id: settlement.id,
      label: settlementLabel(settlement, members, meUserId, tr),
      settledAt: settlement.settledAt,
      amount: settlement.amount,
      mine: settlement.fromMemberId === me || settlement.toMemberId === me,
    }))
    .sort((a, b) => Date.parse(b.settledAt) - Date.parse(a.settledAt) || b.id - a.id);
}

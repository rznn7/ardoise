import { type GroupMember } from '@ardoise/shared';
import { marker } from '@jsverse/transloco-keys-manager/marker';
import { type Translator } from 'src/app/shared/i18n/translation-key';

interface Parties {
  readonly fromMemberId: number;
  readonly toMemberId: number;
}

const nameOf = (members: readonly GroupMember[], memberId: number, tr: Translator): string =>
  members.find((member) => member.id === memberId)?.name ?? tr.translate(marker('common.someone'));

export function settlementLabel(
  { fromMemberId, toMemberId }: Parties,
  members: readonly GroupMember[],
  meUserId: number,
  tr: Translator,
): string {
  const me = members.find((member) => member.userId === meUserId)?.id;
  const from = nameOf(members, fromMemberId, tr);
  const to = nameOf(members, toMemberId, tr);
  if (fromMemberId === me) return tr.translate(marker('settlement.label.youPaid'), { name: to });
  if (toMemberId === me) return tr.translate(marker('settlement.label.paidYou'), { name: from });
  return tr.translate(marker('settlement.label.paid'), { from, to });
}

export const involvesMe = (
  { fromMemberId, toMemberId }: Parties,
  members: readonly GroupMember[],
  meUserId: number,
): boolean => {
  const me = members.find((member) => member.userId === meUserId)?.id;
  return me !== undefined && (fromMemberId === me || toMemberId === me);
};

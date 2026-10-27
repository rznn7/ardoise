import { type GroupMember } from '@ardoise/shared';

interface Parties {
  readonly fromMemberId: number;
  readonly toMemberId: number;
}

const nameOf = (members: readonly GroupMember[], memberId: number): string =>
  members.find((member) => member.id === memberId)?.name ?? 'Someone';

export function settlementLabel(
  { fromMemberId, toMemberId }: Parties,
  members: readonly GroupMember[],
  meUserId: number,
): string {
  const me = members.find((member) => member.userId === meUserId)?.id;
  if (fromMemberId === me) return `You paid ${nameOf(members, toMemberId)} back`;
  if (toMemberId === me) return `${nameOf(members, fromMemberId)} paid you back`;
  return `${nameOf(members, fromMemberId)} paid ${nameOf(members, toMemberId)} back`;
}

export const involvesMe = (
  { fromMemberId, toMemberId }: Parties,
  members: readonly GroupMember[],
  meUserId: number,
): boolean => {
  const me = members.find((member) => member.userId === meUserId)?.id;
  return me !== undefined && (fromMemberId === me || toMemberId === me);
};

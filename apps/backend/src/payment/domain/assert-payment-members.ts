import { type SplitParticipant } from '@ardoise/shared';
import { type Member, NotAMember } from 'src/member/domain/member';

import { ParticipantNotInGroup, PayerNotInGroup } from './payment';

export const assertPaymentMembers = (
  groupMembers: readonly Member[],
  input: {
    readonly userId: number;
    readonly payerMemberId: number;
    readonly participants: readonly SplitParticipant[];
  },
): void => {
  const memberIds = new Set(groupMembers.map((m) => m.id));

  if (!groupMembers.some((m) => m.userId === input.userId))
    throw new NotAMember();
  if (!memberIds.has(input.payerMemberId)) throw new PayerNotInGroup();
  if (input.participants.some((p) => !memberIds.has(p.memberId)))
    throw new ParticipantNotInGroup();
};

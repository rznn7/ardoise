import { type MemberRepository } from 'src/member/domain/member-repository';

import {
  InviteLinkConsumed,
  InviteLinkExpired,
  InviteLinkNotFound,
} from './invite-link';
import { type InviteLinkRepository } from './invite-link-repository';

export const consumeInviteLink = async (
  deps: { inviteLinks: InviteLinkRepository; members: MemberRepository },
  input: { token: string; userId: number },
): Promise<{ groupId: number; alreadyMember: boolean }> => {
  const link = await deps.inviteLinks.findByToken(input.token);
  if (!link) throw new InviteLinkNotFound();

  const existing = await deps.members.findByUserAndGroup(
    input.userId,
    link.groupId,
  );
  if (existing) return { groupId: link.groupId, alreadyMember: true };

  const now = new Date();
  if (link.expiresAt < now) throw new InviteLinkExpired();
  if (link.consumedAt !== null) throw new InviteLinkConsumed();

  const created = await deps.members.create({
    userId: input.userId,
    groupId: link.groupId,
  });
  if (created === null) return { groupId: link.groupId, alreadyMember: true };

  await deps.inviteLinks.markConsumed(link.id, input.userId);

  return { groupId: link.groupId, alreadyMember: false };
};

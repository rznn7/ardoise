import { type ExpenseGroupRepository } from 'src/expense-group/domain/expense-group-repository';

import {
  InviteLink,
  InviteLinkConsumed,
  InviteLinkExpired,
  InviteLinkNotFound,
} from './invite-link';
import { type InviteLinkRepository } from './invite-link-repository';

export const previewInviteLink = async (
  deps: {
    inviteLinks: InviteLinkRepository;
    expenseGroups: ExpenseGroupRepository;
  },
  input: { token: string },
): Promise<{ groupName: string }> => {
  const link = await deps.inviteLinks.findByToken(input.token);
  if (!link) throw new InviteLinkNotFound();
  if (InviteLink.isExpired(link, new Date())) throw new InviteLinkExpired();
  if (InviteLink.isConsumed(link)) throw new InviteLinkConsumed();

  const group = await deps.expenseGroups.findById(link.groupId);
  if (!group) throw new Error(`🚧 work in progress`);

  return { groupName: group.name };
};

import { Inject, Injectable } from '@nestjs/common';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/expense-group/domain/expense-group-repository';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/invite-link/domain/invite-link-repository';
import { previewInviteLink } from 'src/invite-link/domain/preview-invite-link';

@Injectable()
export class PreviewInviteLinkUseCase {
  constructor(
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
  ) {}

  async execute(input: { token: string }): Promise<{ groupName: string }> {
    return previewInviteLink(
      { inviteLinks: this.inviteLinks, expenseGroups: this.expenseGroups },
      input,
    );
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertAdmin } from 'src/admin/domain/admin';
import { InviteLink } from 'src/invite-link/domain/invite-link';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/invite-link/domain/invite-link-repository';
import { type SessionUser } from 'src/shared/http/express';

@Injectable()
export class RevokeInviteLinkUseCase {
  constructor(
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
  ) {}

  async execute({
    caller,
    inviteLinkId,
  }: {
    caller: SessionUser;
    inviteLinkId: number;
  }): Promise<void> {
    assertAdmin(caller);
    const link = await this.inviteLinks.findById(inviteLinkId);
    if (!link) throw new NotFoundException();
    if (InviteLink.isRevoked(link)) return;

    await this.inviteLinks.revoke(inviteLinkId, new Date());
  }
}

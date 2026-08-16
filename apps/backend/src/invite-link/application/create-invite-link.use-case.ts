import { Inject, Injectable } from '@nestjs/common';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/invite-link/domain/invite-link-repository';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class CreateInviteLinkUseCase {
  constructor(
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: {
    userId: number;
    groupId: number;
    expiresAt: Date;
    singleUse: boolean;
  }) {
    const { userId, ...inviteInput } = input;

    const member = await this.members.findByUserAndGroup(userId, input.groupId);
    if (!member?.isModerator) throw new NotAMember();

    const invite = await this.inviteLinks.create({
      token: this.tokenGenerator.generate(),
      ...inviteInput,
    });
    return invite.token;
  }
}

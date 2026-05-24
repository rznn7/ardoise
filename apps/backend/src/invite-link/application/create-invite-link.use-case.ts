import { Inject, Injectable } from '@nestjs/common';
import {
  INVITE_LINK_REPOSITORY,
  type InviteLinkRepository,
} from 'src/invite-link/domain/invite-link-repository';
import {
  TOKEN_GENERATOR,
  type TokenGenerator,
} from 'src/shared/token-generator/token-generator';

@Injectable()
export class CreateInviteLinkUseCase {
  constructor(
    @Inject(INVITE_LINK_REPOSITORY)
    private readonly inviteLinks: InviteLinkRepository,
    @Inject(TOKEN_GENERATOR) private readonly tokenGenerator: TokenGenerator,
  ) {}

  async execute(input: {
    groupId: number;
    expiresAt: Date;
    singleUse: boolean;
  }) {
    const invite = await this.inviteLinks.create({
      token: this.tokenGenerator.generate(),
      ...input,
    });
    return invite.token;
  }
}

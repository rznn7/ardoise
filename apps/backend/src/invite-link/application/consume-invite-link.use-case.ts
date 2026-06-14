import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { consumeInviteLink } from 'src/invite-link/domain/consume-invite-link';

@Injectable()
export class ConsumeInviteLinkUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  async execute(input: {
    token: string;
    userId: number;
  }): Promise<{ groupId: number; alreadyMember: boolean }> {
    return this.uow.run((repos) => consumeInviteLink(repos, input));
  }
}

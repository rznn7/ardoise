import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { consumeInviteLink } from 'src/invite-link/domain/consume-invite-link';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';

@Injectable()
export class ConsumeInviteLinkUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(input: {
    token: string;
    userId: number;
  }): Promise<{ groupId: number; alreadyMember: boolean }> {
    const result = await this.uow.run((repos) =>
      consumeInviteLink(repos, input),
    );
    if (!result.alreadyMember) {
      await this.realtime.groupChanged({
        type: 'member.joined',
        groupId: result.groupId,
        userId: input.userId,
      });
    }
    return result;
  }
}

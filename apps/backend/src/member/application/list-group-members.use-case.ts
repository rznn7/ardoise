import { type GroupMember } from '@ardoise/shared';
import { Inject, Injectable } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class ListGroupMembersUseCase {
  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
  }: {
    userId: number;
    groupId: number;
  }): Promise<GroupMember[]> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    const members = await this.members.findByGroupId(groupId);
    return members.map(({ id, userId, nickname, isModerator }) => ({
      id,
      userId,
      nickname,
      isModerator,
    }));
  }
}

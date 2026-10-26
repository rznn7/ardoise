import { Inject, Injectable } from '@nestjs/common';
import { type NamedMember, NotAMember } from 'src/member/domain/member';
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
  }): Promise<NamedMember[]> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    return this.members.findNamedByGroupId(groupId);
  }
}

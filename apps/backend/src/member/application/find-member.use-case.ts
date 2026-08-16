import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type Member, NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class FindMemberUseCase {
  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    memberId,
  }: {
    userId: number;
    memberId: number;
  }): Promise<Member> {
    const member = await this.members.findById(memberId);
    if (!member) throw new NotFoundException();

    const membership = await this.members.findByUserAndGroup(
      userId,
      member.groupId,
    );
    if (!membership) throw new NotAMember();

    return member;
  }
}

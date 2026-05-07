import { Inject, Injectable } from '@nestjs/common';
import { type Member } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class FindMemberUseCase {
  constructor(
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  execute(id: number): Promise<Member | null> {
    return this.members.findById(id);
  }
}

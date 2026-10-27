import { Inject, Injectable } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import {
  type Settlement,
  settlementCursorOf,
} from 'src/settlement/domain/settlement';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from 'src/settlement/domain/settlement-repository';
import { decodeCursor, PAGE_SIZE } from 'src/shared/pagination/cursor';
import { type Page, toPage } from 'src/shared/pagination/page';

@Injectable()
export class ListGroupSettlementsUseCase {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
    cursor,
  }: {
    userId: number;
    groupId: number;
    cursor: string | undefined;
  }): Promise<Page<Settlement>> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    const after = cursor === undefined ? null : decodeCursor(cursor);
    const fetched = await this.settlements.findPageByGroup(
      groupId,
      after,
      PAGE_SIZE + 1,
    );
    return toPage(fetched, PAGE_SIZE, settlementCursorOf);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import {
  type Settlement,
  SettlementNotFound,
} from 'src/settlement/domain/settlement';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from 'src/settlement/domain/settlement-repository';

@Injectable()
export class GetSettlementUseCase {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    settlementId,
  }: {
    userId: number;
    settlementId: number;
  }): Promise<Settlement> {
    const settlement = await this.settlements.findById(settlementId);
    if (!settlement) throw new SettlementNotFound();

    const membership = await this.members.findByUserAndGroup(
      userId,
      settlement.groupId,
    );
    if (!membership) throw new NotAMember();

    return settlement;
  }
}

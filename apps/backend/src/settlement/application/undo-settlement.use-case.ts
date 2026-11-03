import { Inject, Injectable } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';
import {
  assertInvolved,
  SettlementNotFound,
} from 'src/settlement/domain/settlement';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from 'src/settlement/domain/settlement-repository';

@Injectable()
export class UndoSettlementUseCase {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute({
    userId,
    settlementId,
    opId,
  }: {
    userId: number;
    settlementId: number;
    opId?: string;
  }): Promise<void> {
    const settlement = await this.settlements.findById(settlementId);
    if (!settlement) throw new SettlementNotFound();

    const membership = await this.members.findByUserAndGroup(
      userId,
      settlement.groupId,
    );
    if (!membership) throw new NotAMember();
    assertInvolved(settlement, membership.id);

    await this.settlements.delete(settlementId);
    await this.realtime.groupChanged({
      type: 'settlement.deleted',
      groupId: settlement.groupId,
      id: settlementId,
      opId,
    });
  }
}

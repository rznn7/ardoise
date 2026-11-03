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
  assertValidSettlement,
  type Settlement,
  SettlementMemberNotInGroup,
} from 'src/settlement/domain/settlement';
import {
  SETTLEMENT_REPOSITORY,
  type SettlementRepository,
} from 'src/settlement/domain/settlement-repository';

@Injectable()
export class RecordSettlementUseCase {
  constructor(
    @Inject(SETTLEMENT_REPOSITORY)
    private readonly settlements: SettlementRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(input: {
    userId: number;
    groupId: number;
    fromMemberId: number;
    toMemberId: number;
    amount: number;
    opId?: string;
  }): Promise<Settlement> {
    const groupMembers = await this.members.findByGroupId(input.groupId);
    const caller = groupMembers.find((m) => m.userId === input.userId);
    if (!caller) throw new NotAMember();

    assertValidSettlement(input);
    const memberIds = new Set(groupMembers.map((m) => m.id));
    if (!memberIds.has(input.fromMemberId) || !memberIds.has(input.toMemberId))
      throw new SettlementMemberNotInGroup();
    assertInvolved(input, caller.id);

    const settlement = await this.settlements.create({
      groupId: input.groupId,
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      amount: input.amount,
      settledAt: new Date(),
      createdByMemberId: caller.id,
    });
    await this.realtime.groupChanged({
      type: 'settlement.saved',
      settlement,
      opId: input.opId,
    });
    return settlement;
  }
}

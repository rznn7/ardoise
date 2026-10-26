import { Inject, Injectable } from '@nestjs/common';
import { type MemberBalance, type Transfer } from 'src/balance/domain/balance';
import {
  BALANCE_REPOSITORY,
  type BalanceRepository,
} from 'src/balance/domain/balance-repository';
import { netBalances } from 'src/balance/domain/net-balances';
import { simplifyDebts } from 'src/balance/domain/simplify-debts';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class GetGroupBalancesUseCase {
  constructor(
    @Inject(BALANCE_REPOSITORY) private readonly ledger: BalanceRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
  }: {
    userId: number;
    groupId: number;
  }): Promise<{ balances: MemberBalance[]; transfers: Transfer[] }> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    const balances = netBalances(await this.ledger.totalsByGroup(groupId));
    return { balances, transfers: simplifyDebts(balances) };
  }
}

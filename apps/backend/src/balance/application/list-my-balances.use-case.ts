import { Inject, Injectable } from '@nestjs/common';
import {
  BALANCE_REPOSITORY,
  type BalanceRepository,
} from 'src/balance/domain/balance-repository';
import { netOf } from 'src/balance/domain/net-balances';

@Injectable()
export class ListMyBalancesUseCase {
  constructor(
    @Inject(BALANCE_REPOSITORY) private readonly ledger: BalanceRepository,
  ) {}

  async execute({
    userId,
  }: {
    userId: number;
  }): Promise<{ groupId: number; amount: number }[]> {
    const memberships = await this.ledger.totalsOfUser(userId);
    return memberships.map((totals) => ({
      groupId: totals.groupId,
      amount: netOf(totals),
    }));
  }
}

import { balanceApi, type GroupBalancesResponse } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { GetGroupBalancesUseCase } from 'src/balance/application/get-group-balances.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class BalanceController {
  constructor(private readonly getGroupBalances: GetGroupBalancesUseCase) {}

  @Route(balanceApi.listByGroup)
  listByGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<GroupBalancesResponse> {
    return this.getGroupBalances.execute({ userId: user.id, groupId });
  }
}

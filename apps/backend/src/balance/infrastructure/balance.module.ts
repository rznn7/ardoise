import { Module } from '@nestjs/common';
import { GetGroupBalancesUseCase } from 'src/balance/application/get-group-balances.use-case';
import { ListMyBalancesUseCase } from 'src/balance/application/list-my-balances.use-case';
import { BALANCE_REPOSITORY } from 'src/balance/domain/balance-repository';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { BalanceController } from './balance.controller';
import { BalanceRepositoryDrizzle } from './balance-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, MemberModule],
  providers: [
    { provide: BALANCE_REPOSITORY, useClass: BalanceRepositoryDrizzle },
    GetGroupBalancesUseCase,
    ListMyBalancesUseCase,
  ],
  exports: [BALANCE_REPOSITORY],
  controllers: [BalanceController],
})
export class BalanceModule {}

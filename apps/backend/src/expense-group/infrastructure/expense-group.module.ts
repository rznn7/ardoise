import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from 'src/auth/domain/unit-of-work';
import { CreateExpenseGroupUseCase } from 'src/expense-group/application/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/expense-group/application/find-expense-group.use-case';
import { ListMyExpenseGroupsUseCase } from 'src/expense-group/application/list-my-expense-groups.use-case';
import { EXPENSE_GROUP_REPOSITORY } from 'src/expense-group/domain/expense-group-repository';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UnitOfWorkDrizzle } from 'src/shared/database/unit-of-work.drizzle';

import { ExpenseGroupController } from './expense-group.controller';
import { ExpenseGroupRepositoryDrizzle } from './expense-group-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, MemberModule],
  providers: [
    {
      provide: EXPENSE_GROUP_REPOSITORY,
      useClass: ExpenseGroupRepositoryDrizzle,
    },
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
    FindExpenseGroupUseCase,
    CreateExpenseGroupUseCase,
    ListMyExpenseGroupsUseCase,
  ],
  exports: [EXPENSE_GROUP_REPOSITORY],
  controllers: [ExpenseGroupController],
})
export class ExpenseGroupModule {}

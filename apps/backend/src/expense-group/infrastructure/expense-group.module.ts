import { Module } from '@nestjs/common';
import { CreateExpenseGroupUseCase } from 'src/expense-group/application/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/expense-group/application/find-expense-group.use-case';
import { EXPENSE_GROUP_REPOSITORY } from 'src/expense-group/domain/expense-group-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { ExpenseGroupController } from './expense-group.controller';
import { ExpenseGroupRepositoryDrizzle } from './expense-group-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule],
  providers: [
    {
      provide: EXPENSE_GROUP_REPOSITORY,
      useClass: ExpenseGroupRepositoryDrizzle,
    },
    FindExpenseGroupUseCase,
    CreateExpenseGroupUseCase,
  ],
  exports: [EXPENSE_GROUP_REPOSITORY],
  controllers: [ExpenseGroupController],
})
export class ExpenseGroupModule {}

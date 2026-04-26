import { Module } from '@nestjs/common';
import { CreateExpenseGroupUseCase } from 'src/application/expense-group/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/application/expense-group/find-expense-group.use-case';
import { EXPENSE_GROUP_REPOSITORY } from 'src/domain/expense-group/expense-group-repository';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

import { ExpenseGroupController } from './expense-group.controller';
import { ExpenseGroupRepositoryDrizzle } from './expense-group-repository.drizzle';

@Module({
  imports: [DatabaseModule],
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

import { DatabaseModule } from '../database/database.module';
import { EXPENSE_GROUP_REPOSITORY } from 'src/domain/expense-group/expense-group-repository';
import { ExpenseGroupController } from './expense-group.controller';
import { ExpenseGroupRepositoryDrizzle } from './expense-group-repository.drizzle';
import { Module } from '@nestjs/common';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: EXPENSE_GROUP_REPOSITORY,
      useClass: ExpenseGroupRepositoryDrizzle,
    },
  ],
  exports: [EXPENSE_GROUP_REPOSITORY],
  controllers: [ExpenseGroupController],
})
export class ExpenseGroupModule {}

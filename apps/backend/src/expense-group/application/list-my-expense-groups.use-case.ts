import { Inject, Injectable } from '@nestjs/common';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/expense-group/domain/expense-group-repository';

@Injectable()
export class ListMyExpenseGroupsUseCase {
  constructor(
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
  ) {}

  execute(userId: number): Promise<ExpenseGroup[]> {
    return this.expenseGroups.findByUserId(userId);
  }
}

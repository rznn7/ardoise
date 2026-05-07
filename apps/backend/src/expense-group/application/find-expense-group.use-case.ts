import { Inject, Injectable } from '@nestjs/common';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/expense-group/domain/expense-group-repository';

@Injectable()
export class FindExpenseGroupUseCase {
  constructor(
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
  ) {}

  execute(id: number): Promise<ExpenseGroup | null> {
    return this.expenseGroups.findById(id);
  }
}

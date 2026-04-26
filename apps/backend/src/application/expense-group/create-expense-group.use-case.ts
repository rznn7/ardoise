import { Inject, Injectable } from '@nestjs/common';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/domain/expense-group/expense-group-repository';

@Injectable()
export class CreateExpenseGroupUseCase {
  constructor(
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
  ) {}

  execute(input: { name: string; currencyCode: string }) {
    return this.expenseGroups.create(input);
  }
}

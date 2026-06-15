import { type ExpenseGroupSummary } from '@ardoise/shared';
import { Inject, Injectable } from '@nestjs/common';
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

  async execute(userId: number): Promise<ExpenseGroupSummary[]> {
    const groups = await this.expenseGroups.findByUserId(userId);
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      currencyCode: group.currencyCode,
      createdAt: group.createdAt.toISOString(),
    }));
  }
}

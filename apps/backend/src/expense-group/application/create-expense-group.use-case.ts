import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';

@Injectable()
export class CreateExpenseGroupUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  execute(input: {
    name: string;
    currencyCode: string;
    userId: number;
  }): Promise<ExpenseGroup> {
    return this.uow.run(async (repos) => {
      const group = await repos.expenseGroups.create({
        name: input.name,
        currencyCode: input.currencyCode,
      });
      await repos.members.create({
        userId: input.userId,
        groupId: group.id,
        isModerator: true,
      });
      return group;
    });
  }
}

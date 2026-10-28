import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';

@Injectable()
export class CreateExpenseGroupUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(input: {
    name: string;
    currencyCode: string;
    userId: number;
  }): Promise<ExpenseGroup> {
    const group = await this.uow.run(async (repos) => {
      const created = await repos.expenseGroups.create({
        name: input.name,
        currencyCode: input.currencyCode,
      });
      await repos.members.create({
        userId: input.userId,
        groupId: created.id,
        isModerator: true,
      });
      return created;
    });
    await this.realtime.groupChanged({
      type: 'group.created',
      groupId: group.id,
      userId: input.userId,
    });
    return group;
  }
}

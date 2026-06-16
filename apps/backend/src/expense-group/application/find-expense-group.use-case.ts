import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ExpenseGroup } from 'src/expense-group/domain/expense-group';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/expense-group/domain/expense-group-repository';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class FindExpenseGroupUseCase {
  constructor(
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
  }: {
    userId: number;
    groupId: number;
  }): Promise<ExpenseGroup> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    const group = await this.expenseGroups.findById(groupId);
    if (!group) throw new NotFoundException();
    return group;
  }
}

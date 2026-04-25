import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  EXPENSE_GROUP_REPOSITORY,
  type ExpenseGroupRepository,
} from 'src/domain/expense-group/expense-group-repository';

@Controller('expense-groups')
export class ExpenseGroupController {
  constructor(
    @Inject(EXPENSE_GROUP_REPOSITORY)
    private readonly expenseGroups: ExpenseGroupRepository,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.expenseGroups.findById(id);
  }
}

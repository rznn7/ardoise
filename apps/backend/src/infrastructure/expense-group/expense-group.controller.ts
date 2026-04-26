import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FindExpenseGroupUseCase } from 'src/application/expense-group/find-expense-group.use-case';

@Controller('expense-groups')
export class ExpenseGroupController {
  constructor(private readonly findExpenseGroup: FindExpenseGroupUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findExpenseGroup.execute(id);
  }
}

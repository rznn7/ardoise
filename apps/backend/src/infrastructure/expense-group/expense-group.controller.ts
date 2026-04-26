import {
  type CreateExpenseGroupRequest,
  createExpenseGroupRequestSchema,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateExpenseGroupUseCase } from 'src/application/expense-group/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/application/expense-group/find-expense-group.use-case';
import { ZodValidationPipe } from '../http/zod-validation.pipe';

@Controller('expense-groups')
export class ExpenseGroupController {
  constructor(
    private readonly findExpenseGroup: FindExpenseGroupUseCase,
    private readonly createExpenseGroup: CreateExpenseGroupUseCase,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findExpenseGroup.execute(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createExpenseGroupRequestSchema))
    body: CreateExpenseGroupRequest,
  ) {
    return this.createExpenseGroup.execute(body);
  }
}

import {
  type CreateExpenseGroupRequest,
  createExpenseGroupRequestSchema,
  type ExpenseGroupSummary,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateExpenseGroupUseCase } from 'src/expense-group/application/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/expense-group/application/find-expense-group.use-case';
import { ListMyExpenseGroupsUseCase } from 'src/expense-group/application/list-my-expense-groups.use-case';
import { toExpenseGroupSummary } from 'src/expense-group/infrastructure/expense-group.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller('expense-groups')
@UseGuards(SessionGuard)
export class ExpenseGroupController {
  constructor(
    private readonly findExpenseGroup: FindExpenseGroupUseCase,
    private readonly createExpenseGroup: CreateExpenseGroupUseCase,
    private readonly listMyExpenseGroups: ListMyExpenseGroupsUseCase,
  ) {}

  @Get()
  async findMine(
    @CurrentUser() user: SessionUser,
  ): Promise<ExpenseGroupSummary[]> {
    const groups = await this.listMyExpenseGroups.execute(user.id);
    return groups.map(toExpenseGroupSummary);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<ExpenseGroupSummary> {
    const group = await this.findExpenseGroup.execute({
      userId: user.id,
      groupId: id,
    });
    return toExpenseGroupSummary(group);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createExpenseGroupRequestSchema))
    body: CreateExpenseGroupRequest,
  ) {
    return this.createExpenseGroup.execute(body);
  }
}

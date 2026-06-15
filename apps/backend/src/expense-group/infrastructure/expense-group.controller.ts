import {
  type CreateExpenseGroupRequest,
  createExpenseGroupRequestSchema,
  type ExpenseGroupSummary,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { CreateExpenseGroupUseCase } from 'src/expense-group/application/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/expense-group/application/find-expense-group.use-case';
import { ListMyExpenseGroupsUseCase } from 'src/expense-group/application/list-my-expense-groups.use-case';
import { toExpenseGroupSummary } from 'src/expense-group/infrastructure/expense-group.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
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
  async findMine(@Req() req: Request): Promise<ExpenseGroupSummary[]> {
    if (!req.user) throw new UnauthorizedException();
    const groups = await this.listMyExpenseGroups.execute(req.user.id);
    return groups.map(toExpenseGroupSummary);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ExpenseGroupSummary> {
    const group = await this.findExpenseGroup.execute(id);
    if (!group) throw new NotFoundException();
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

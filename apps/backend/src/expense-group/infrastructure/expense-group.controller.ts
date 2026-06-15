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
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { CreateExpenseGroupUseCase } from 'src/expense-group/application/create-expense-group.use-case';
import { FindExpenseGroupUseCase } from 'src/expense-group/application/find-expense-group.use-case';
import { ListMyExpenseGroupsUseCase } from 'src/expense-group/application/list-my-expense-groups.use-case';
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
  findMine(@Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return this.listMyExpenseGroups.execute(req.user.id);
  }

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

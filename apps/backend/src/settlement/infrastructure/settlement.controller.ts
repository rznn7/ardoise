import {
  type CreateSettlementRequest,
  type PageQuery,
  settlementApi,
  type SettlementPage,
  type SettlementResponse,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { GetSettlementUseCase } from 'src/settlement/application/get-settlement.use-case';
import { ListGroupSettlementsUseCase } from 'src/settlement/application/list-group-settlements.use-case';
import { RecordSettlementUseCase } from 'src/settlement/application/record-settlement.use-case';
import { UndoSettlementUseCase } from 'src/settlement/application/undo-settlement.use-case';
import { toSettlementResponse } from 'src/settlement/infrastructure/settlement.mapper';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller()
@UseGuards(SessionGuard)
export class SettlementController {
  constructor(
    private readonly getSettlement: GetSettlementUseCase,
    private readonly listGroupSettlements: ListGroupSettlementsUseCase,
    private readonly recordSettlement: RecordSettlementUseCase,
    private readonly undoSettlement: UndoSettlementUseCase,
  ) {}

  @Route(settlementApi.listByGroup)
  async listByGroup(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query(new ZodValidationPipe(settlementApi.listByGroup.query))
    query: PageQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<SettlementPage> {
    const page = await this.listGroupSettlements.execute({
      userId: user.id,
      groupId,
      cursor: query.cursor,
    });
    return {
      items: page.items.map(toSettlementResponse),
      nextCursor: page.nextCursor,
    };
  }

  @Route(settlementApi.findOne)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<SettlementResponse> {
    const settlement = await this.getSettlement.execute({
      userId: user.id,
      settlementId: id,
    });
    return toSettlementResponse(settlement);
  }

  @Route(settlementApi.create)
  async create(
    @Body(new ZodValidationPipe(settlementApi.create.body))
    body: CreateSettlementRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<SettlementResponse> {
    const settlement = await this.recordSettlement.execute({
      ...body,
      userId: user.id,
    });
    return toSettlementResponse(settlement);
  }

  @Route(settlementApi.delete)
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.undoSettlement.execute({ userId: user.id, settlementId: id });
  }
}

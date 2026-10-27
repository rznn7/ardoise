import {
  feedApi,
  type FeedItem as FeedItemResponse,
  type FeedPage,
  type PageQuery,
} from '@ardoise/shared';
import {
  Controller,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ListGroupFeedUseCase } from 'src/feed/application/list-group-feed.use-case';
import { type FeedItem } from 'src/feed/domain/feed';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { toSettlementResponse } from 'src/settlement/infrastructure/settlement.mapper';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

const toFeedItemResponse = (item: FeedItem): FeedItemResponse =>
  item.kind === 'payment'
    ? { kind: 'payment', payment: toPaymentResponse(item.payment) }
    : { kind: 'settlement', settlement: toSettlementResponse(item.settlement) };

@Controller()
@UseGuards(SessionGuard)
export class FeedController {
  constructor(private readonly listGroupFeed: ListGroupFeedUseCase) {}

  @Route(feedApi.listByGroup)
  async list(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Query(new ZodValidationPipe(feedApi.listByGroup.query)) query: PageQuery,
    @CurrentUser() user: SessionUser,
  ): Promise<FeedPage> {
    const page = await this.listGroupFeed.execute({
      userId: user.id,
      groupId,
      cursor: query.cursor,
    });
    return {
      items: page.items.map(toFeedItemResponse),
      nextCursor: page.nextCursor,
    };
  }
}

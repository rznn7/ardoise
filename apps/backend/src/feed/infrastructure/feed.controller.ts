import { feedApi, type FeedItem as FeedItemResponse } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ListGroupFeedUseCase } from 'src/feed/application/list-group-feed.use-case';
import { type FeedItem } from 'src/feed/domain/feed';
import { toPaymentResponse } from 'src/payment/infrastructure/payment.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { toSettlementResponse } from 'src/settlement/infrastructure/settlement.mapper';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

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
    @CurrentUser() user: SessionUser,
  ): Promise<FeedItemResponse[]> {
    const items = await this.listGroupFeed.execute({
      userId: user.id,
      groupId,
    });
    return items.map(toFeedItemResponse);
  }
}

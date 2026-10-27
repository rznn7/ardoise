import { type Payment } from 'src/payment/domain/payment';
import { type Settlement } from 'src/settlement/domain/settlement';
import { type Cursor } from 'src/shared/pagination/cursor';

export type FeedItem =
  | { readonly kind: 'payment'; readonly payment: Payment }
  | { readonly kind: 'settlement'; readonly settlement: Settlement };

const dateOf = (item: FeedItem): number =>
  item.kind === 'payment'
    ? item.payment.paidAt.getTime()
    : item.settlement.settledAt.getTime();

const idOf = (item: FeedItem): number =>
  item.kind === 'payment' ? item.payment.id : item.settlement.id;

const kindRank = (item: FeedItem): number => (item.kind === 'payment' ? 0 : 1);

export const newestFirst = (a: FeedItem, b: FeedItem): number =>
  dateOf(b) - dateOf(a) || kindRank(a) - kindRank(b) || idOf(b) - idOf(a);

export const cursorOf = (item: FeedItem): Cursor => ({
  date: new Date(dateOf(item)),
  rank: kindRank(item) === 0 ? 0 : 1,
  id: idOf(item),
});

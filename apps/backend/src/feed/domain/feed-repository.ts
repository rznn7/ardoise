import { type FeedItem } from './feed';

export const FEED_REPOSITORY = Symbol('FEED_REPOSITORY');

export interface FeedRepository {
  findByGroupId(groupId: number): Promise<FeedItem[]>;
}

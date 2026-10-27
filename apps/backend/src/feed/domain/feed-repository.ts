import { type Cursor } from 'src/shared/pagination/cursor';

import { type FeedItem } from './feed';

export const FEED_REPOSITORY = Symbol('FEED_REPOSITORY');

export interface FeedRepository {
  findPage(
    groupId: number,
    after: Cursor | null,
    size: number,
  ): Promise<FeedItem[]>;
}

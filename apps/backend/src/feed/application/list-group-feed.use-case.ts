import { Inject, Injectable } from '@nestjs/common';
import { cursorOf, type FeedItem } from 'src/feed/domain/feed';
import {
  FEED_REPOSITORY,
  type FeedRepository,
} from 'src/feed/domain/feed-repository';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import { decodeCursor, PAGE_SIZE } from 'src/shared/pagination/cursor';
import { type Page, toPage } from 'src/shared/pagination/page';

@Injectable()
export class ListGroupFeedUseCase {
  constructor(
    @Inject(FEED_REPOSITORY) private readonly feed: FeedRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
    cursor,
  }: {
    userId: number;
    groupId: number;
    cursor: string | undefined;
  }): Promise<Page<FeedItem>> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    const after = cursor === undefined ? null : decodeCursor(cursor);
    const fetched = await this.feed.findPage(groupId, after, PAGE_SIZE + 1);
    return toPage(fetched, PAGE_SIZE, cursorOf);
  }
}

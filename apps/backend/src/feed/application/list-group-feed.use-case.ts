import { Inject, Injectable } from '@nestjs/common';
import { type FeedItem } from 'src/feed/domain/feed';
import {
  FEED_REPOSITORY,
  type FeedRepository,
} from 'src/feed/domain/feed-repository';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';

@Injectable()
export class ListGroupFeedUseCase {
  constructor(
    @Inject(FEED_REPOSITORY) private readonly feed: FeedRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    groupId,
  }: {
    userId: number;
    groupId: number;
  }): Promise<FeedItem[]> {
    const membership = await this.members.findByUserAndGroup(userId, groupId);
    if (!membership) throw new NotAMember();

    return this.feed.findByGroupId(groupId);
  }
}

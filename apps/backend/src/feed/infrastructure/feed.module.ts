import { Module } from '@nestjs/common';
import { ListGroupFeedUseCase } from 'src/feed/application/list-group-feed.use-case';
import { FEED_REPOSITORY } from 'src/feed/domain/feed-repository';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { FeedController } from './feed.controller';
import { FeedRepositoryDrizzle } from './feed-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, MemberModule],
  providers: [
    { provide: FEED_REPOSITORY, useClass: FeedRepositoryDrizzle },
    ListGroupFeedUseCase,
  ],
  controllers: [FeedController],
})
export class FeedModule {}

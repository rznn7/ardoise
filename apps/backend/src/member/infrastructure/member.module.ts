import { Module } from '@nestjs/common';
import { FindMemberUseCase } from 'src/member/application/find-member.use-case';
import { ListGroupMembersUseCase } from 'src/member/application/list-group-members.use-case';
import { MEMBER_REPOSITORY } from 'src/member/domain/member-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { GroupMemberController } from './group-member.controller';
import { MemberController } from './member.controller';
import { MemberRepositoryDrizzle } from './member-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule],
  providers: [
    {
      provide: MEMBER_REPOSITORY,
      useClass: MemberRepositoryDrizzle,
    },
    FindMemberUseCase,
    ListGroupMembersUseCase,
  ],
  exports: [MEMBER_REPOSITORY],
  controllers: [MemberController, GroupMemberController],
})
export class MemberModule {}

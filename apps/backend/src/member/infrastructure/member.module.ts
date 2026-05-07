import { Module } from '@nestjs/common';
import { FindMemberUseCase } from 'src/member/application/find-member.use-case';
import { MEMBER_REPOSITORY } from 'src/member/domain/member-repository';
import { DatabaseModule } from 'src/shared/database/database.module';

import { MemberController } from './member.controller';
import { MemberRepositoryDrizzle } from './member-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MEMBER_REPOSITORY,
      useClass: MemberRepositoryDrizzle,
    },
    FindMemberUseCase,
  ],
  exports: [MEMBER_REPOSITORY],
  controllers: [MemberController],
})
export class MemberModule {}

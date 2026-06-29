import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from 'src/auth/domain/unit-of-work';
import { ConsumeInviteLinkUseCase } from 'src/invite-link/application/consume-invite-link.use-case';
import { CreateInviteLinkUseCase } from 'src/invite-link/application/create-invite-link.use-case';
import { INVITE_LINK_REPOSITORY } from 'src/invite-link/domain/invite-link-repository';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UnitOfWorkDrizzle } from 'src/shared/database/unit-of-work.drizzle';
import { TokenGeneratorModule } from 'src/shared/token-generator/token-generator.module';

import { InviteLinkController } from './invite-link.controller';
import { InviteLinkRepositoryDrizzle } from './invite-link-repository.drizzle';

@Module({
  imports: [DatabaseModule, TokenGeneratorModule, SessionModule, MemberModule],
  providers: [
    {
      provide: INVITE_LINK_REPOSITORY,
      useClass: InviteLinkRepositoryDrizzle,
    },
    CreateInviteLinkUseCase,
    ConsumeInviteLinkUseCase,
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
  ],
  exports: [INVITE_LINK_REPOSITORY],
  controllers: [InviteLinkController],
})
export class InviteLinkModule {}

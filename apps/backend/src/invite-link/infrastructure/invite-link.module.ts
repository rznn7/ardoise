import { Module } from '@nestjs/common';
import { CreateInviteLinkUseCase } from 'src/invite-link/application/create-invite-link.use-case';
import { INVITE_LINK_REPOSITORY } from 'src/invite-link/domain/invite-link-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';
import { TokenGeneratorModule } from 'src/shared/token-generator/token-generator.module';

import { InviteLinkController } from './invite-link.controller';
import { InviteLinkRepositoryDrizzle } from './invite-link-repository.drizzle';

@Module({
  imports: [DatabaseModule, TokenGeneratorModule, SessionModule],
  providers: [
    {
      provide: INVITE_LINK_REPOSITORY,
      useClass: InviteLinkRepositoryDrizzle,
    },
    CreateInviteLinkUseCase,
  ],
  exports: [INVITE_LINK_REPOSITORY],
  controllers: [InviteLinkController],
})
export class InviteLinkModule {}

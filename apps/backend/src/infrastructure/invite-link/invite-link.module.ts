import { Module } from '@nestjs/common';
import { INVITE_LINK_REPOSITORY } from 'src/domain/invite-link/invite-link-repository';
import { DatabaseModule } from '../database/database.module';
import { InviteLinkRepositoryDrizzle } from './invite-link-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: INVITE_LINK_REPOSITORY,
      useClass: InviteLinkRepositoryDrizzle,
    },
  ],
  exports: [INVITE_LINK_REPOSITORY],
})
export class InviteLinkModule {}

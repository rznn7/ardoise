import { Inject, Injectable } from '@nestjs/common';
import {
  type TransactionalRepositories,
  type UnitOfWork,
} from 'src/auth/domain/unit-of-work';
import { SessionRepositoryDrizzle } from 'src/auth/infrastructure/session-repository.drizzle';
import { InviteLinkRepositoryDrizzle } from 'src/invite-link/infrastructure/invite-link-repository.drizzle';
import { MemberRepositoryDrizzle } from 'src/member/infrastructure/member-repository.drizzle';
import { PasskeyRepositoryDrizzle } from 'src/passkey/infrastructure/passkey-repository.drizzle';
import { UserRepositoryDrizzle } from 'src/user/infrastructure/user-repository.drizzle';

import { type Database, DATABASE_CONNECTION } from './database.module';

@Injectable()
export class UnitOfWorkDrizzle implements UnitOfWork {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly database: Database,
  ) {}

  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.database.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      return work({
        users: new UserRepositoryDrizzle(txDb),
        passkeys: new PasskeyRepositoryDrizzle(txDb),
        members: new MemberRepositoryDrizzle(txDb),
        inviteLinks: new InviteLinkRepositoryDrizzle(txDb),
        sessions: new SessionRepositoryDrizzle(txDb),
      });
    });
  }
}

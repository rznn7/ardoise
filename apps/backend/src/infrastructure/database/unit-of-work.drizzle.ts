import { Inject, Injectable } from '@nestjs/common';
import {
  type TransactionalRepositories,
  type UnitOfWork,
} from 'src/domain/auth/unit-of-work';
import { InviteLinkRepositoryDrizzle } from '../invite-link/invite-link-repository.drizzle';
import { MemberRepositoryDrizzle } from '../member/member-repository.drizzle';
import { PasskeyRepositoryDrizzle } from '../passkey/passkey-repository.drizzle';
import { UserRepositoryDrizzle } from '../user/user-repository.drizzle';
import { DATABASE_CONNECTION, type Database } from './database.module';

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
      });
    });
  }
}

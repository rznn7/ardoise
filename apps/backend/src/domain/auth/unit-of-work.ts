import { type InviteLinkRepository } from 'src/domain/invite-link/invite-link-repository';
import { type MemberRepository } from 'src/domain/member/member-repository';
import { type PasskeyRepository } from 'src/domain/passkey/passkey-repository';
import { type UserRepository } from 'src/domain/user/user-repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface TransactionalRepositories {
  users: UserRepository;
  passkeys: PasskeyRepository;
  members: MemberRepository;
  inviteLinks: InviteLinkRepository;
}

export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

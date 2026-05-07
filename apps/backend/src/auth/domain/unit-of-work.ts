import { type SessionRepository } from 'src/auth/domain/session-repository';
import { type InviteLinkRepository } from 'src/invite-link/domain/invite-link-repository';
import { type MemberRepository } from 'src/member/domain/member-repository';
import { type PasskeyRepository } from 'src/passkey/domain/passkey-repository';
import { type UserRepository } from 'src/user/domain/user-repository';

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

export interface TransactionalRepositories {
  users: UserRepository;
  passkeys: PasskeyRepository;
  members: MemberRepository;
  inviteLinks: InviteLinkRepository;
  sessions: SessionRepository;
}

export interface UnitOfWork {
  run<T>(work: (repos: TransactionalRepositories) => Promise<T>): Promise<T>;
}

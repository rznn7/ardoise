import { Inject, Injectable } from '@nestjs/common';
import {
  Session,
  SessionExpired,
  SessionNotFound,
} from 'src/session/domain/session';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from 'src/session/domain/session-repository';
import { UserNotFound } from 'src/user/domain/user';
import {
  USER_REPOSITORY,
  type UserRepository,
} from 'src/user/domain/user-repository';

@Injectable()
export class MeUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async execute(sessionToken: string) {
    const session = await this.sessions.findByToken(sessionToken);

    if (!session) throw new SessionNotFound();
    if (!Session.isValid(session, new Date())) throw new SessionExpired();

    const user = await this.users.findById(session.userId);
    if (!user) throw new UserNotFound();

    return user;
  }
}

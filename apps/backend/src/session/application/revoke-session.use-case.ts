import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertAdmin } from 'src/admin/domain/admin';
import {
  CannotRevokeCurrentSession,
  Session,
} from 'src/session/domain/session';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from 'src/session/domain/session-repository';
import { type SessionUser } from 'src/shared/http/express';

@Injectable()
export class RevokeSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute({
    caller,
    sessionId,
    currentToken,
  }: {
    caller: SessionUser;
    sessionId: number;
    currentToken: string | undefined;
  }): Promise<void> {
    assertAdmin(caller);
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundException();
    if (session.token === currentToken) throw new CannotRevokeCurrentSession();

    const now = new Date();
    if (!Session.isValid(session, now)) return;
    await this.sessions.save(Session.revoke(session, now));
  }
}

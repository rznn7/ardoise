import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { assertAdmin } from 'src/admin/domain/admin';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';
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
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
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
    this.realtime.sessionEnded(session.id);
  }
}

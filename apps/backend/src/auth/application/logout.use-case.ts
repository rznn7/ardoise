import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';
import { Session } from 'src/session/domain/session';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(token: string) {
    const revokedSessionId = await this.uow.run(async (repos) => {
      const now = new Date();
      const session = await repos.sessions.findByToken(token);
      if (!session || !Session.isValid(session, now)) return null;
      const revokedSession = Session.revoke(session, now);
      await repos.sessions.save(revokedSession);
      return session.id;
    });
    if (revokedSessionId !== null) this.realtime.sessionEnded(revokedSessionId);
  }
}

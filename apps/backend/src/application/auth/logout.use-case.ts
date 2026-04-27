import { Inject, Injectable } from '@nestjs/common';
import { Session } from 'src/domain/auth/session';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/domain/auth/unit-of-work';

@Injectable()
export class LogoutUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  async execute(token: string) {
    await this.uow.run(async (repos) => {
      const now = new Date();
      const session = await repos.sessions.findByToken(token);
      if (!session || !Session.isValid(session, now)) return;
      const revokedSession = Session.revoke(session, now);
      await repos.sessions.save(revokedSession);
    });
  }
}

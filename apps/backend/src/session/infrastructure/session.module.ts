import { Module } from '@nestjs/common';
import { MeUseCase } from 'src/session/application/me.use-case';
import { RevokeSessionUseCase } from 'src/session/application/revoke-session.use-case';
import { SESSION_REPOSITORY } from 'src/session/domain/session-repository';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UserModule } from 'src/user/infrastructure/user.module';

import { AdminSessionController } from './admin-session.controller';
import { SessionGuard } from './session.guard';
import { SessionRepositoryDrizzle } from './session-repository.drizzle';

@Module({
  imports: [DatabaseModule, UserModule],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: SessionRepositoryDrizzle },
    MeUseCase,
    SessionGuard,
    RevokeSessionUseCase,
  ],
  exports: [SESSION_REPOSITORY, MeUseCase, SessionGuard],
  controllers: [AdminSessionController],
})
export class SessionModule {}

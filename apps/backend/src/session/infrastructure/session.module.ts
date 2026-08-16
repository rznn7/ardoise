import { forwardRef, Module } from '@nestjs/common';
import { MeUseCase } from 'src/session/application/me.use-case';
import { SESSION_REPOSITORY } from 'src/session/domain/session-repository';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UserModule } from 'src/user/infrastructure/user.module';

import { SessionGuard } from './session.guard';
import { SessionRepositoryDrizzle } from './session-repository.drizzle';

@Module({
  imports: [DatabaseModule, forwardRef(() => UserModule)],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: SessionRepositoryDrizzle },
    MeUseCase,
    SessionGuard,
  ],
  exports: [SESSION_REPOSITORY, MeUseCase, SessionGuard],
})
export class SessionModule {}

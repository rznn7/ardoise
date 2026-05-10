import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BeginLoginUseCase } from 'src/auth/application/begin-login.use-case';
import { BeginRegistrationUseCase } from 'src/auth/application/begin-registration.use-case';
import { CompleteLoginUseCase } from 'src/auth/application/complete-login.use-case';
import { CompleteRegistrationUseCase } from 'src/auth/application/complete-registration.use-case';
import { LogoutUseCase } from 'src/auth/application/logout.use-case';
import { MeUseCase } from 'src/auth/application/me.use-case';
import { PASSKEY_VERIFIER } from 'src/auth/domain/passkey-verifier';
import { SESSION_REPOSITORY } from 'src/auth/domain/session-repository';
import { TOKEN_GENERATOR } from 'src/auth/domain/token-generator';
import { UNIT_OF_WORK } from 'src/auth/domain/unit-of-work';
import { PasskeyVerifierSimpleWebauthn } from 'src/auth/infrastructure/passkey-verifier.simplewebauthn';
import { InviteLinkModule } from 'src/invite-link/infrastructure/invite-link.module';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UserModule } from 'src/user/infrastructure/user.module';
import { UnitOfWorkDrizzle } from 'src/shared/database/unit-of-work.drizzle';

import { AuthController } from './auth.controller';
import { SessionRepositoryDrizzle } from './session-repository.drizzle';
import { TokenGeneratorCrypto } from './token-generator.crypto';

@Module({
  imports: [
    InviteLinkModule,
    DatabaseModule,
    UserModule,
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    BeginRegistrationUseCase,
    CompleteRegistrationUseCase,
    BeginLoginUseCase,
    CompleteLoginUseCase,
    LogoutUseCase,
    MeUseCase,
    { provide: PASSKEY_VERIFIER, useClass: PasskeyVerifierSimpleWebauthn },
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
    { provide: TOKEN_GENERATOR, useClass: TokenGeneratorCrypto },
    { provide: SESSION_REPOSITORY, useClass: SessionRepositoryDrizzle },
  ],
  controllers: [AuthController],
})
export class AuthModule {}

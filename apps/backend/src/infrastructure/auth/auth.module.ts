import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BeginRegistrationUseCase } from 'src/application/auth/begin-registration.use-case';
import { CompleteRegistrationUseCase } from 'src/application/auth/complete-registration.use-case';
import { LogoutUseCase } from 'src/application/auth/logout.use-case';
import { PASSKEY_VERIFIER } from 'src/domain/auth/passkey-verifier';
import { TOKEN_GENERATOR } from 'src/domain/auth/token-generator';
import { UNIT_OF_WORK } from 'src/domain/auth/unit-of-work';
import { DatabaseModule } from 'src/infrastructure/database/database.module';
import { UnitOfWorkDrizzle } from 'src/infrastructure/database/unit-of-work.drizzle';
import { InviteLinkModule } from 'src/infrastructure/invite-link/invite-link.module';
import { PasskeyVerifierSimpleWebauthn } from 'src/infrastructure/webauthn/passkey-verifier.simplewebauthn';

import { AuthController } from './auth.controller';
import { TokenGeneratorCrypto } from './token-generator.crypto';

@Module({
  imports: [
    InviteLinkModule,
    DatabaseModule,
    ConfigModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    BeginRegistrationUseCase,
    CompleteRegistrationUseCase,
    LogoutUseCase,
    { provide: PASSKEY_VERIFIER, useClass: PasskeyVerifierSimpleWebauthn },
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
    { provide: TOKEN_GENERATOR, useClass: TokenGeneratorCrypto },
  ],
  controllers: [AuthController],
})
export class AuthModule {}

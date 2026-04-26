import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BeginRegistrationUseCase } from 'src/application/auth/begin-registration.use-case';
import { CompleteRegistrationUseCase } from 'src/application/auth/complete-registration.use-case';
import { PASSKEY_VERIFIER } from 'src/domain/auth/passkey-verifier';
import { UNIT_OF_WORK } from 'src/domain/auth/unit-of-work';
import { DatabaseModule } from '../database/database.module';
import { UnitOfWorkDrizzle } from '../database/unit-of-work.drizzle';
import { InviteLinkModule } from '../invite-link/invite-link.module';
import { PasskeyVerifierSimpleWebauthn } from '../webauthn/passkey-verifier.simplewebauthn';
import { AuthController } from './auth.controller';

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
    { provide: PASSKEY_VERIFIER, useClass: PasskeyVerifierSimpleWebauthn },
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
  ],
  controllers: [AuthController],
})
export class AuthModule {}

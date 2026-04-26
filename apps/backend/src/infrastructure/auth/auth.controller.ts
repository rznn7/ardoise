import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { BeginRegistrationUseCase } from 'src/application/auth/begin-registration.use-case';
import { CompleteRegistrationUseCase } from 'src/application/auth/complete-registration.use-case';
import { type RegistrationState } from 'src/domain/auth/registration-state';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly beginRegistration: BeginRegistrationUseCase,
    private readonly completeRegistration: CompleteRegistrationUseCase,
  ) {}

  @Post('register/begin')
  begin(@Body() body: { inviteToken: string }) {
    return this.beginRegistration.execute({ inviteToken: body.inviteToken });
  }

  @Post('register/complete')
  @HttpCode(204)
  async complete(
    @Body()
    body: {
      registrationState: RegistrationState;
      attestation: RegistrationResponseJSON;
      name: string;
    },
  ) {
    await this.completeRegistration.execute(body);
  }
}

import {
  type BeginRegistrationRequest,
  beginRegistrationRequestSchema,
  type CompleteRegistrationRequest,
  completeRegistrationRequestSchema,
} from '@ardoise/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { BeginRegistrationUseCase } from 'src/application/auth/begin-registration.use-case';
import { CompleteRegistrationUseCase } from 'src/application/auth/complete-registration.use-case';
import { ZodValidationPipe } from 'src/infrastructure/http/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly beginRegistration: BeginRegistrationUseCase,
    private readonly completeRegistration: CompleteRegistrationUseCase,
  ) {}

  @Post('register/begin')
  begin(
    @Body(new ZodValidationPipe(beginRegistrationRequestSchema))
    body: BeginRegistrationRequest,
  ) {
    return this.beginRegistration.execute({ inviteToken: body.inviteToken });
  }

  @Post('register/complete')
  @HttpCode(204)
  async complete(
    @Body(new ZodValidationPipe(completeRegistrationRequestSchema))
    body: CompleteRegistrationRequest,
  ) {
    await this.completeRegistration.execute({
      ...body,
      attestation: body.attestation as RegistrationResponseJSON,
    });
  }
}

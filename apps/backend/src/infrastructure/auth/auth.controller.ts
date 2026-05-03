import {
  type BeginRegistrationRequest,
  beginRegistrationRequestSchema,
  type CompleteRegistrationRequest,
  completeRegistrationRequestSchema,
} from '@ardoise/shared';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Response } from 'express';
import { BeginRegistrationUseCase } from 'src/application/auth/begin-registration.use-case';
import { CompleteRegistrationUseCase } from 'src/application/auth/complete-registration.use-case';
import { LogoutUseCase } from 'src/application/auth/logout.use-case';
import { Cookie } from 'src/infrastructure/http/cookie.decorator';
import { ZodValidationPipe } from 'src/infrastructure/http/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly beginRegistration: BeginRegistrationUseCase,
    private readonly completeRegistration: CompleteRegistrationUseCase,
    private readonly doLogout: LogoutUseCase,
  ) {}

  @Post('register/begin')
  @HttpCode(200)
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

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Cookie('session_token') token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (token) await this.doLogout.execute(token);
    res.clearCookie('session_token', { path: '/' });
  }
}

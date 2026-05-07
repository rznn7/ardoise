import {
  BeginLoginResponse,
  type BeginRegistrationRequest,
  beginRegistrationRequestSchema,
  type CompleteLoginRequest,
  completeLoginRequestSchema,
  type CompleteRegistrationRequest,
  completeRegistrationRequestSchema,
} from '@ardoise/shared';
import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Response } from 'express';
import { BeginLoginUseCase } from 'src/auth/application/begin-login.use-case';
import { BeginRegistrationUseCase } from 'src/auth/application/begin-registration.use-case';
import { CompleteLoginUseCase } from 'src/auth/application/complete-login.use-case';
import { CompleteRegistrationUseCase } from 'src/auth/application/complete-registration.use-case';
import { LogoutUseCase } from 'src/auth/application/logout.use-case';
import { SESSION_TTL_MS } from 'src/auth/domain/session';
import { Cookie } from 'src/shared/http/cookie.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly beginRegistration: BeginRegistrationUseCase,
    private readonly completeRegistration: CompleteRegistrationUseCase,
    private readonly beginLogin: BeginLoginUseCase,
    private readonly completeLogin: CompleteLoginUseCase,
    private readonly doLogout: LogoutUseCase,
  ) {}

  @Post('register/begin')
  @HttpCode(200)
  registerBegin(
    @Body(new ZodValidationPipe(beginRegistrationRequestSchema))
    body: BeginRegistrationRequest,
  ) {
    return this.beginRegistration.execute({ inviteToken: body.inviteToken });
  }

  @Post('register/complete')
  @HttpCode(204)
  registerComplete(
    @Body(new ZodValidationPipe(completeRegistrationRequestSchema))
    body: CompleteRegistrationRequest,
  ) {
    return this.completeRegistration.execute({
      ...body,
      attestation: body.attestation as RegistrationResponseJSON,
    });
  }

  @Post('login/begin')
  @HttpCode(200)
  loginBegin(): Promise<BeginLoginResponse> {
    return this.beginLogin.execute();
  }

  @Post('login/complete')
  @HttpCode(204)
  async loginComplete(
    @Body(new ZodValidationPipe(completeLoginRequestSchema))
    body: CompleteLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { token } = await this.completeLogin.execute({
      loginState: body.loginState,
      assertion: { credentialId: body.assertion.id, raw: body.assertion },
    });

    res.cookie('session_token', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: false, //TODO: enable secure for production environments
      maxAge: SESSION_TTL_MS,
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

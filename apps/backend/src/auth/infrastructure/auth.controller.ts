import {
  authApi,
  BeginLoginResponse,
  type BeginRegistrationRequest,
  type BeginRegistrationResponse,
  type CompleteLoginRequest,
  type CompleteRegistrationRequest,
  type MeResponse,
} from '@ardoise/shared';
import { Body, Controller, Res, UnauthorizedException } from '@nestjs/common';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import type { Response } from 'express';
import { BeginLoginUseCase } from 'src/auth/application/begin-login.use-case';
import { BeginRegistrationUseCase } from 'src/auth/application/begin-registration.use-case';
import { CompleteLoginUseCase } from 'src/auth/application/complete-login.use-case';
import { CompleteRegistrationUseCase } from 'src/auth/application/complete-registration.use-case';
import { LogoutUseCase } from 'src/auth/application/logout.use-case';
import { MeUseCase } from 'src/session/application/me.use-case';
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from 'src/session/domain/session';
import { Cookie } from 'src/shared/http/cookie';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller()
export class AuthController {
  constructor(
    private readonly beginRegistration: BeginRegistrationUseCase,
    private readonly completeRegistration: CompleteRegistrationUseCase,
    private readonly beginLogin: BeginLoginUseCase,
    private readonly completeLogin: CompleteLoginUseCase,
    private readonly doLogout: LogoutUseCase,
    private readonly doMe: MeUseCase,
  ) {}

  @Route(authApi.registerBegin)
  registerBegin(
    @Body(new ZodValidationPipe(authApi.registerBegin.body))
    body: BeginRegistrationRequest,
  ): Promise<BeginRegistrationResponse> {
    return this.beginRegistration.execute({ inviteToken: body.inviteToken });
  }

  @Route(authApi.registerComplete)
  registerComplete(
    @Body(new ZodValidationPipe(authApi.registerComplete.body))
    body: CompleteRegistrationRequest,
  ): Promise<void> {
    return this.completeRegistration.execute({
      ...body,
      attestation: body.attestation as RegistrationResponseJSON,
    });
  }

  @Route(authApi.loginBegin)
  loginBegin(): Promise<BeginLoginResponse> {
    return this.beginLogin.execute();
  }

  @Route(authApi.loginComplete)
  async loginComplete(
    @Body(new ZodValidationPipe(authApi.loginComplete.body))
    body: CompleteLoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { token } = await this.completeLogin.execute({
      stateId: body.stateId,
      assertion: { credentialId: body.assertion.id, raw: body.assertion },
    });

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: false, //TODO: enable secure for production environments
      maxAge: SESSION_TTL_MS,
    });
  }

  @Route(authApi.logout)
  async logout(
    @Cookie(SESSION_COOKIE_NAME) token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (token) await this.doLogout.execute(token);
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  }

  @Route(authApi.me)
  async me(
    @Cookie(SESSION_COOKIE_NAME) token: string | undefined,
  ): Promise<MeResponse> {
    if (!token) throw new UnauthorizedException();
    return await this.doMe.execute(token);
  }
}

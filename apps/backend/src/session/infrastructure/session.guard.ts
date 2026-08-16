import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { MeUseCase } from 'src/session/application/me.use-case';
import {
  SESSION_COOKIE_NAME,
  SessionNotFound,
} from 'src/session/domain/session';
import { getCookie } from 'src/shared/http/cookie';
import { IS_PUBLIC_KEY } from 'src/shared/http/public.decorator';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly me: MeUseCase,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const sessionToken = getCookie(req, SESSION_COOKIE_NAME);

    if (sessionToken === undefined) throw new SessionNotFound();

    const user = await this.me.execute(sessionToken);
    req.user = user;
    return true;
  }
}

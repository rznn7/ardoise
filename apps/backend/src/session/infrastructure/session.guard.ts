import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { MeUseCase } from 'src/session/application/me.use-case';
import {
  SESSION_COOKIE_NAME,
  SessionNotFound,
} from 'src/session/domain/session';
import { getCookie } from 'src/shared/http/cookie';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly me: MeUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const sessionToken = getCookie(req, SESSION_COOKIE_NAME);

    if (sessionToken === undefined) throw new SessionNotFound();

    const user = await this.me.execute(sessionToken);
    req.user = user;
    return true;
  }
}

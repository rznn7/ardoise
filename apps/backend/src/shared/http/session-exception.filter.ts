import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionExpired, SessionNotFound } from 'src/auth/domain/session';

@Catch(SessionNotFound, SessionExpired)
export class SessionExceptionFilter implements ExceptionFilter {
  catch(_: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const unauthorized = new UnauthorizedException();

    response.status(unauthorized.getStatus()).json(unauthorized.getResponse());
  }
}

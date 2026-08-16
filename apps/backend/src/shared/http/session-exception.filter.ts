import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PasskeyNotFound } from 'src/passkey/domain/passkey';
import {
  SessionExpired,
  SessionNotFound,
  UserHandleMismatch,
} from 'src/session/domain/session';
import { UserNotFound } from 'src/user/domain/user';

@Catch(
  SessionNotFound,
  SessionExpired,
  PasskeyNotFound,
  UserHandleMismatch,
  UserNotFound,
)
export class SessionExceptionFilter implements ExceptionFilter {
  catch(_: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const unauthorized = new UnauthorizedException();

    response.status(unauthorized.getStatus()).json(unauthorized.getResponse());
  }
}

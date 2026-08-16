import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  LoginStateExpired,
  LoginStateNotFound,
} from 'src/auth/domain/login-state';
import {
  RegistrationStateExpired,
  RegistrationStateNotFound,
} from 'src/auth/domain/registration-state';

@Catch(
  RegistrationStateNotFound,
  RegistrationStateExpired,
  LoginStateNotFound,
  LoginStateExpired,
)
export class AuthStateExceptionFilter implements ExceptionFilter {
  catch(_: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const error = new BadRequestException('invalid or expired state');

    response.status(error.getStatus()).json(error.getResponse());
  }
}

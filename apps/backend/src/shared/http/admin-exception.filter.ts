import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  AdminGroupNotFound,
  AdminUserNotFound,
  NotAnAdmin,
} from 'src/admin/domain/admin';
import { CannotRevokeCurrentSession } from 'src/session/domain/session';

@Catch(
  NotAnAdmin,
  AdminUserNotFound,
  AdminGroupNotFound,
  CannotRevokeCurrentSession,
)
export class AdminExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof NotAnAdmin) {
      response.status(403).json({ error: 'NOT_AN_ADMIN' });
    } else if (exception instanceof CannotRevokeCurrentSession) {
      response.status(400).json({ error: 'CANNOT_REVOKE_CURRENT_SESSION' });
    } else {
      response.status(404).json({ error: 'NOT_FOUND' });
    }
  }
}

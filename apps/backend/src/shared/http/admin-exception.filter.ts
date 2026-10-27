import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  AdminGroupNotFound,
  AdminUserNotFound,
  NotAnAdmin,
} from 'src/admin/domain/admin';

@Catch(NotAnAdmin, AdminUserNotFound, AdminGroupNotFound)
export class AdminExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof NotAnAdmin) {
      response.status(403).json({ error: 'NOT_AN_ADMIN' });
    } else {
      response.status(404).json({ error: 'NOT_FOUND' });
    }
  }
}

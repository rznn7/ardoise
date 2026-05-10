import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import { InviteLinkNotFound } from 'src/invite-link/domain/invite-link';

@Catch(InviteLinkNotFound)
export class InviteLinkExceptionFilter implements ExceptionFilter {
  catch(_: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const error = new BadRequestException('invite link not found or expired');

    response.status(error.getStatus()).json(error.getResponse());
  }
}

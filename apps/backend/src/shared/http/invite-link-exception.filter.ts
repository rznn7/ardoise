import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import {
  InviteLinkConsumed,
  InviteLinkExpired,
  InviteLinkNotFound,
} from 'src/invite-link/domain/invite-link';

@Catch(InviteLinkNotFound, InviteLinkExpired, InviteLinkConsumed)
export class InviteLinkExceptionFilter implements ExceptionFilter<Error> {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    let error = 'UNKNOWN';
    if (exception instanceof InviteLinkNotFound) error = 'INVITE_NOT_FOUND';
    else if (exception instanceof InviteLinkExpired) error = 'INVITE_EXPIRED';
    else if (exception instanceof InviteLinkConsumed) error = 'INVITE_CONSUMED';

    response.status(400).json({ error });
  }
}

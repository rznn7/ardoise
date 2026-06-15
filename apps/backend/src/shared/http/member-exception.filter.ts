import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { NotAMember } from 'src/member/domain/member';

@Catch(NotAMember)
export class MemberExceptionFilter implements ExceptionFilter<Error> {
  catch(_: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(403).json({ error: 'NOT_A_MEMBER' });
  }
}

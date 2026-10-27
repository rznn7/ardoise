import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidCursor } from 'src/shared/pagination/cursor';

@Catch(InvalidCursor)
export class PaginationExceptionFilter implements ExceptionFilter<InvalidCursor> {
  catch(_: InvalidCursor, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(400)
      .json({ error: 'INVALID_CURSOR' });
  }
}

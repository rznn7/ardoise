import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SessionUser } from 'src/shared/http/express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) throw new UnauthorizedException();
    return req.user;
  },
);

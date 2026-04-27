import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const Cookie = createParamDecorator(
  (name: string, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[name];
  },
);

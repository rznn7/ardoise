import { OP_ID_HEADER } from '@ardoise/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

const VALID_OP_ID = /^[A-Za-z0-9-]{1,64}$/;

export const OpId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const value = ctx.switchToHttp().getRequest<Request>().header(OP_ID_HEADER);
    return value !== undefined && VALID_OP_ID.test(value) ? value : undefined;
  },
);

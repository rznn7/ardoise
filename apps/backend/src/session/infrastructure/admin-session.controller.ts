import { adminApi } from '@ardoise/shared';
import {
  Controller,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RevokeSessionUseCase } from 'src/session/application/revoke-session.use-case';
import { SESSION_COOKIE_NAME } from 'src/session/domain/session';
import { getCookie } from 'src/shared/http/cookie';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

import { SessionGuard } from './session.guard';

@Controller()
@UseGuards(SessionGuard)
export class AdminSessionController {
  constructor(private readonly revokeSession: RevokeSessionUseCase) {}

  @Route(adminApi.revokeSession)
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: SessionUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.revokeSession.execute({
      caller,
      sessionId: id,
      currentToken: getCookie(req, SESSION_COOKIE_NAME),
    });
  }
}

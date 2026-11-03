import {
  Controller,
  Headers,
  type MessageEvent,
  Req,
  Sse,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable } from 'rxjs';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

import { RealtimeHub } from './realtime-hub';

@Controller()
@UseGuards(SessionGuard)
export class RealtimeController {
  constructor(private readonly hub: RealtimeHub) {}

  @Sse('events')
  events(
    @Req() req: Request,
    @Headers('last-event-id') lastEventId: string | undefined,
  ): Observable<MessageEvent> {
    const { user, authSession } = req;
    if (!user || !authSession) throw new UnauthorizedException();
    return this.hub.stream(
      {
        userId: user.id,
        sessionId: authSession.id,
        sessionExpiresAt: authSession.expiresAt,
      },
      lastEventId,
    );
  }
}

import { adminApi } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { RevokeInviteLinkUseCase } from 'src/invite-link/application/revoke-invite-link.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class AdminInviteLinkController {
  constructor(private readonly revokeInviteLink: RevokeInviteLinkUseCase) {}

  @Route(adminApi.revokeInviteLink)
  async revoke(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() caller: SessionUser,
  ): Promise<void> {
    await this.revokeInviteLink.execute({ caller, inviteLinkId: id });
  }
}

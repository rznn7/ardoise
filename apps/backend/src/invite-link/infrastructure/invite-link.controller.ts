import {
  type ConsumeInviteLinkRequest,
  type ConsumeInviteLinkResponse,
  type CreateInviteLinkRequest,
  type CreateInviteLinkResponse,
  inviteLinkApi,
} from '@ardoise/shared';
import { Body, Controller, UseGuards } from '@nestjs/common';
import { ConsumeInviteLinkUseCase } from 'src/invite-link/application/consume-invite-link.use-case';
import { CreateInviteLinkUseCase } from 'src/invite-link/application/create-invite-link.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller()
@UseGuards(SessionGuard)
export class InviteLinkController {
  constructor(
    private readonly createInviteLink: CreateInviteLinkUseCase,
    private readonly consumeInviteLink: ConsumeInviteLinkUseCase,
  ) {}

  @Route(inviteLinkApi.create)
  async create(
    @Body(new ZodValidationPipe(inviteLinkApi.create.body))
    body: CreateInviteLinkRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<CreateInviteLinkResponse> {
    const token = await this.createInviteLink.execute({
      ...body,
      userId: user.id,
    });
    return { token };
  }

  @Route(inviteLinkApi.consume)
  async consume(
    @Body(new ZodValidationPipe(inviteLinkApi.consume.body))
    body: ConsumeInviteLinkRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<ConsumeInviteLinkResponse> {
    return this.consumeInviteLink.execute({
      token: body.token,
      userId: user.id,
    });
  }
}

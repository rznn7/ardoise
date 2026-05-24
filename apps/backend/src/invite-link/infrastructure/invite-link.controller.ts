import {
  type CreateInviteLinkRequest,
  createInviteLinkRequestSchema,
} from '@ardoise/shared';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateInviteLinkUseCase } from 'src/invite-link/application/create-invite-link.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller('invite-link')
@UseGuards(SessionGuard)
export class InviteLinkController {
  constructor(private readonly createInviteLink: CreateInviteLinkUseCase) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createInviteLinkRequestSchema))
    body: CreateInviteLinkRequest,
  ) {
    const token = await this.createInviteLink.execute(body);
    return { token };
  }
}

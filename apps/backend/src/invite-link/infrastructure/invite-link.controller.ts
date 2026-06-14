import {
  type ConsumeInviteLinkRequest,
  consumeInviteLinkRequestSchema,
  type ConsumeInviteLinkResponse,
  type CreateInviteLinkRequest,
  createInviteLinkRequestSchema,
} from '@ardoise/shared';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { ConsumeInviteLinkUseCase } from 'src/invite-link/application/consume-invite-link.use-case';
import { CreateInviteLinkUseCase } from 'src/invite-link/application/create-invite-link.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';

@Controller('invite-link')
@UseGuards(SessionGuard)
export class InviteLinkController {
  constructor(
    private readonly createInviteLink: CreateInviteLinkUseCase,
    private readonly consumeInviteLink: ConsumeInviteLinkUseCase,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createInviteLinkRequestSchema))
    body: CreateInviteLinkRequest,
  ) {
    const token = await this.createInviteLink.execute(body);
    return { token };
  }

  @Post('consume')
  @HttpCode(200)
  async consume(
    @Body(new ZodValidationPipe(consumeInviteLinkRequestSchema))
    body: ConsumeInviteLinkRequest,
    @Req() req: Request,
  ): Promise<ConsumeInviteLinkResponse> {
    if (!req.user) throw new UnauthorizedException();

    return this.consumeInviteLink.execute({
      token: body.token,
      userId: req.user.id,
    });
  }
}

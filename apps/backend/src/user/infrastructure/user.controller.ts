import {
  type MeResponse,
  type RenameUserRequest,
  userApi,
} from '@ardoise/shared';
import { Body, Controller, UseGuards } from '@nestjs/common';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';
import { ZodValidationPipe } from 'src/shared/http/zod-validation.pipe';
import { RenameUserUseCase } from 'src/user/application/rename-user.use-case';

@Controller()
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly renameUser: RenameUserUseCase) {}

  @Route(userApi.renameMe)
  async renameMe(
    @Body(new ZodValidationPipe(userApi.renameMe.body))
    body: RenameUserRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<MeResponse> {
    const renamed = await this.renameUser.execute({
      userId: user.id,
      name: body.name,
    });
    return { id: renamed.id, name: renamed.name, role: renamed.role };
  }
}

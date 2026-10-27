import {
  adminApi,
  type AdminGroup,
  type AdminOverview,
  type AdminUser,
} from '@ardoise/shared';
import {
  Controller,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { GetAdminGroupUseCase } from 'src/admin/application/get-admin-group.use-case';
import { GetAdminOverviewUseCase } from 'src/admin/application/get-admin-overview.use-case';
import { GetAdminUserUseCase } from 'src/admin/application/get-admin-user.use-case';
import {
  toAdminGroup,
  toAdminOverview,
  toAdminUser,
} from 'src/admin/infrastructure/admin.mapper';
import { SESSION_COOKIE_NAME } from 'src/session/domain/session';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { getCookie } from 'src/shared/http/cookie';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class AdminController {
  constructor(
    private readonly getOverview: GetAdminOverviewUseCase,
    private readonly getUser: GetAdminUserUseCase,
    private readonly getGroup: GetAdminGroupUseCase,
  ) {}

  @Route(adminApi.overview)
  async overview(@CurrentUser() caller: SessionUser): Promise<AdminOverview> {
    return toAdminOverview(await this.getOverview.execute({ caller }));
  }

  @Route(adminApi.user)
  async user(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() caller: SessionUser,
    @Req() req: Request,
  ): Promise<AdminUser> {
    const detail = await this.getUser.execute({
      caller,
      userId,
      currentToken: getCookie(req, SESSION_COOKIE_NAME),
    });
    return toAdminUser(detail);
  }

  @Route(adminApi.group)
  async group(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() caller: SessionUser,
  ): Promise<AdminGroup> {
    return toAdminGroup(await this.getGroup.execute({ caller, groupId }));
  }
}

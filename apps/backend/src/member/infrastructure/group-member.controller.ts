import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type Request } from 'express';
import { ListGroupMembersUseCase } from 'src/member/application/list-group-members.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('expense-groups/:groupId/members')
@UseGuards(SessionGuard)
export class GroupMemberController {
  constructor(private readonly listGroupMembers: ListGroupMembersUseCase) {}

  @Get()
  list(@Param('groupId', ParseIntPipe) groupId: number, @Req() req: Request) {
    if (!req.user) throw new UnauthorizedException();
    return this.listGroupMembers.execute({ userId: req.user.id, groupId });
  }
}

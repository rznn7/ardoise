import { type GroupMember } from '@ardoise/shared';
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
import { toGroupMember } from 'src/member/infrastructure/member.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('expense-groups/:groupId/members')
@UseGuards(SessionGuard)
export class GroupMemberController {
  constructor(private readonly listGroupMembers: ListGroupMembersUseCase) {}

  @Get()
  async list(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
  ): Promise<GroupMember[]> {
    if (!req.user) throw new UnauthorizedException();
    const members = await this.listGroupMembers.execute({
      userId: req.user.id,
      groupId,
    });
    return members.map(toGroupMember);
  }
}

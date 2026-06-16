import { type GroupMember } from '@ardoise/shared';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ListGroupMembersUseCase } from 'src/member/application/list-group-members.use-case';
import { toGroupMember } from 'src/member/infrastructure/member.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';

@Controller('expense-groups/:groupId/members')
@UseGuards(SessionGuard)
export class GroupMemberController {
  constructor(private readonly listGroupMembers: ListGroupMembersUseCase) {}

  @Get()
  async list(
    @Param('groupId', ParseIntPipe) groupId: number,
    @CurrentUser() user: SessionUser,
  ): Promise<GroupMember[]> {
    const members = await this.listGroupMembers.execute({
      userId: user.id,
      groupId,
    });
    return members.map(toGroupMember);
  }
}

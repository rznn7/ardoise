import { memberApi, type MemberResponse } from '@ardoise/shared';
import { Controller, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { FindMemberUseCase } from 'src/member/application/find-member.use-case';
import { toMemberResponse } from 'src/member/infrastructure/member.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { CurrentUser } from 'src/shared/http/current-user.decorator';
import { type SessionUser } from 'src/shared/http/express';
import { Route } from 'src/shared/http/route.decorator';

@Controller()
@UseGuards(SessionGuard)
export class MemberController {
  constructor(private readonly findMember: FindMemberUseCase) {}

  @Route(memberApi.findOne)
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: SessionUser,
  ): Promise<MemberResponse> {
    const member = await this.findMember.execute({
      userId: user.id,
      memberId: id,
    });
    return toMemberResponse(member);
  }
}

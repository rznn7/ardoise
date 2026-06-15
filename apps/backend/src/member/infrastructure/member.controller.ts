import { type MemberResponse } from '@ardoise/shared';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindMemberUseCase } from 'src/member/application/find-member.use-case';
import { toMemberResponse } from 'src/member/infrastructure/member.mapper';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('members')
@UseGuards(SessionGuard)
export class MemberController {
  constructor(private readonly findMember: FindMemberUseCase) {}

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MemberResponse> {
    const member = await this.findMember.execute(id);
    if (!member) throw new NotFoundException();
    return toMemberResponse(member);
  }
}

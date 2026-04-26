import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/domain/member/member-repository';

@Controller('members')
export class MemberController {
  constructor(
    @Inject(MEMBER_REPOSITORY)
    private readonly members: MemberRepository,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.members.findById(id);
  }
}

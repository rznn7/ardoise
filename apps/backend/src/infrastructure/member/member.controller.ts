import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FindMemberUseCase } from 'src/application/member/find-member.use-case';

@Controller('members')
export class MemberController {
  constructor(private readonly findMember: FindMemberUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findMember.execute(id);
  }
}

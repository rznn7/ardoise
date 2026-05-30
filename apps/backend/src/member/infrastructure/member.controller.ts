import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { FindMemberUseCase } from 'src/member/application/find-member.use-case';
import { SessionGuard } from 'src/session/infrastructure/session.guard';

@Controller('members')
@UseGuards(SessionGuard)
export class MemberController {
  constructor(private readonly findMember: FindMemberUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findMember.execute(id);
  }
}

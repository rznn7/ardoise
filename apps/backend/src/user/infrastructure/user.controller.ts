import { type MeResponse } from '@ardoise/shared';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { FindUserUseCase } from 'src/user/application/find-user.use-case';

@Controller('users')
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly findUser: FindUserUseCase) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MeResponse> {
    const user = await this.findUser.execute(id);
    if (!user) throw new NotFoundException();
    return { id: user.id, name: user.name, role: user.role };
  }
}

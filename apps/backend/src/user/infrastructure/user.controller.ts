import { type MeResponse, userApi } from '@ardoise/shared';
import {
  Controller,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from 'src/session/infrastructure/session.guard';
import { Route } from 'src/shared/http/route.decorator';
import { FindUserUseCase } from 'src/user/application/find-user.use-case';
import { toMeResponse } from 'src/user/infrastructure/user.mapper';

@Controller()
@UseGuards(SessionGuard)
export class UserController {
  constructor(private readonly findUser: FindUserUseCase) {}

  @Route(userApi.findOne)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<MeResponse> {
    const user = await this.findUser.execute(id);
    if (!user) throw new NotFoundException();
    return toMeResponse(user);
  }
}

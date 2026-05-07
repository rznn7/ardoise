import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { FindUserUseCase } from 'src/user/application/find-user.use-case';

@Controller('users')
export class UserController {
  constructor(private readonly findUser: FindUserUseCase) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.findUser.execute(id);
  }
}

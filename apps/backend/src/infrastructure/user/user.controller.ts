import { Controller, Get, Inject, Param, ParseIntPipe } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type UserRepository,
} from 'src/domain/user/user-repository';

@Controller('users')
export class UserController {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.users.findById(id);
  }
}

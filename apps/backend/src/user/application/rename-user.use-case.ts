import { Inject, Injectable } from '@nestjs/common';
import { type User } from 'src/user/domain/user';
import {
  USER_REPOSITORY,
  type UserRepository,
} from 'src/user/domain/user-repository';

@Injectable()
export class RenameUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  execute(input: { userId: number; name: string }): Promise<User> {
    return this.users.rename(input.userId, input.name);
  }
}

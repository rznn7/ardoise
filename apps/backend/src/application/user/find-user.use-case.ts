import { Inject, Injectable } from '@nestjs/common';
import { type User } from 'src/domain/user/user';
import {
  USER_REPOSITORY,
  type UserRepository,
} from 'src/domain/user/user-repository';

@Injectable()
export class FindUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  execute(id: number): Promise<User | null> {
    return this.users.findById(id);
  }
}

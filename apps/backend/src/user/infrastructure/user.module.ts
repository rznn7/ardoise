import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/shared/database/database.module';
import { FindUserUseCase } from 'src/user/application/find-user.use-case';
import { USER_REPOSITORY } from 'src/user/domain/user-repository';

import { UserController } from './user.controller';
import { UserRepositoryDrizzle } from './user-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: USER_REPOSITORY, useClass: UserRepositoryDrizzle },
    FindUserUseCase,
  ],
  exports: [USER_REPOSITORY],
  controllers: [UserController],
})
export class UserModule {}

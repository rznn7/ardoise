import { Module } from '@nestjs/common';
import { FindUserUseCase } from 'src/application/user/find-user.use-case';
import { USER_REPOSITORY } from 'src/domain/user/user-repository';
import { DatabaseModule } from 'src/infrastructure/database/database.module';

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

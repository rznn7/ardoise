import { Module } from '@nestjs/common';
import { FindUserUseCase } from 'src/application/user/find-user.use-case';
import { USER_REPOSITORY } from 'src/domain/user/user-repository';
import { DatabaseModule } from '../database/database.module';
import { UserRepositoryDrizzle } from './user-repository.drizzle';
import { UserController } from './user.controller';

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

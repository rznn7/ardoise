import { DatabaseModule } from '../database/database.module';
import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from 'src/domain/user/user-repository';
import { UserController } from './user.controller';
import { UserRepositoryDrizzle } from './user-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [{ provide: USER_REPOSITORY, useClass: UserRepositoryDrizzle }],
  exports: [USER_REPOSITORY],
  controllers: [UserController],
})
export class UserModule {}

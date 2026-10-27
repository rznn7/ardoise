import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/shared/database/database.module';
import { USER_REPOSITORY } from 'src/user/domain/user-repository';

import { UserRepositoryDrizzle } from './user-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [{ provide: USER_REPOSITORY, useClass: UserRepositoryDrizzle }],
  exports: [USER_REPOSITORY],
})
export class UserModule {}

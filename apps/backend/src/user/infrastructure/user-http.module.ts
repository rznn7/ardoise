import { Module } from '@nestjs/common';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { RenameUserUseCase } from 'src/user/application/rename-user.use-case';

import { UserController } from './user.controller';
import { UserModule } from './user.module';

@Module({
  imports: [UserModule, SessionModule],
  providers: [RenameUserUseCase],
  controllers: [UserController],
})
export class UserHttpModule {}

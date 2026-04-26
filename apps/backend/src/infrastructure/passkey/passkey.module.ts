import { Module } from '@nestjs/common';
import { PASSKEY_REPOSITORY } from 'src/domain/passkey/passkey-repository';
import { DatabaseModule } from '../database/database.module';
import { PasskeyRepositoryDrizzle } from './passkey-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PASSKEY_REPOSITORY,
      useClass: PasskeyRepositoryDrizzle,
    },
  ],
  exports: [PASSKEY_REPOSITORY],
})
export class PasskeyModule {}

import { Global, Module } from '@nestjs/common';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { REALTIME_PUBLISHER } from 'src/realtime/domain/realtime-publisher';
import { SessionModule } from 'src/session/infrastructure/session.module';

import { RealtimeController } from './realtime.controller';
import { RealtimeHub } from './realtime-hub';

@Global()
@Module({
  imports: [MemberModule, SessionModule],
  providers: [
    RealtimeHub,
    { provide: REALTIME_PUBLISHER, useExisting: RealtimeHub },
  ],
  exports: [REALTIME_PUBLISHER],
  controllers: [RealtimeController],
})
export class RealtimeModule {}

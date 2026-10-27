import { Module } from '@nestjs/common';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { GetSettlementUseCase } from 'src/settlement/application/get-settlement.use-case';
import { ListGroupSettlementsUseCase } from 'src/settlement/application/list-group-settlements.use-case';
import { RecordSettlementUseCase } from 'src/settlement/application/record-settlement.use-case';
import { UndoSettlementUseCase } from 'src/settlement/application/undo-settlement.use-case';
import { SETTLEMENT_REPOSITORY } from 'src/settlement/domain/settlement-repository';
import { DatabaseModule } from 'src/shared/database/database.module';

import { SettlementController } from './settlement.controller';
import { SettlementRepositoryDrizzle } from './settlement-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, MemberModule],
  providers: [
    { provide: SETTLEMENT_REPOSITORY, useClass: SettlementRepositoryDrizzle },
    GetSettlementUseCase,
    ListGroupSettlementsUseCase,
    RecordSettlementUseCase,
    UndoSettlementUseCase,
  ],
  controllers: [SettlementController],
})
export class SettlementModule {}

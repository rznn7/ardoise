import { Module } from '@nestjs/common';
import { GetAdminGroupUseCase } from 'src/admin/application/get-admin-group.use-case';
import { GetAdminOverviewUseCase } from 'src/admin/application/get-admin-overview.use-case';
import { GetAdminUserUseCase } from 'src/admin/application/get-admin-user.use-case';
import { ADMIN_READ_REPOSITORY } from 'src/admin/domain/admin-read-repository';
import { BalanceModule } from 'src/balance/infrastructure/balance.module';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { AdminController } from './admin.controller';
import { AdminReadRepositoryDrizzle } from './admin-read-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, BalanceModule],
  providers: [
    { provide: ADMIN_READ_REPOSITORY, useClass: AdminReadRepositoryDrizzle },
    GetAdminOverviewUseCase,
    GetAdminUserUseCase,
    GetAdminGroupUseCase,
  ],
  controllers: [AdminController],
})
export class AdminModule {}

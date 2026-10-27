import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { AdminModule } from './admin/infrastructure/admin.module';
import { AuthModule } from './auth/infrastructure/auth.module';
import { BalanceModule } from './balance/infrastructure/balance.module';
import { ExpenseGroupModule } from './expense-group/infrastructure/expense-group.module';
import { MemberModule } from './member/infrastructure/member.module';
import { PaymentModule } from './payment/infrastructure/payment.module';
import { PaymentShareModule } from './payment-share/infrastructure/payment-share.module';
import { AdminExceptionFilter } from './shared/http/admin-exception.filter';
import { AuthStateExceptionFilter } from './shared/http/auth-state-exception.filter';
import { InviteLinkExceptionFilter } from './shared/http/invite-link-exception.filter';
import { MemberExceptionFilter } from './shared/http/member-exception.filter';
import { PaymentExceptionFilter } from './shared/http/payment-exception.filter';
import { SessionExceptionFilter } from './shared/http/session-exception.filter';
import { UserModule } from './user/infrastructure/user.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    BalanceModule,
    ConfigModule.forRoot(),
    ExpenseGroupModule,
    MemberModule,
    PaymentModule,
    PaymentShareModule,
    UserModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SessionExceptionFilter },
    { provide: APP_FILTER, useClass: InviteLinkExceptionFilter },
    { provide: APP_FILTER, useClass: AuthStateExceptionFilter },
    { provide: APP_FILTER, useClass: MemberExceptionFilter },
    { provide: APP_FILTER, useClass: PaymentExceptionFilter },
    { provide: APP_FILTER, useClass: AdminExceptionFilter },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { AuthModule } from './auth/infrastructure/auth.module';
import { BalanceModule } from './balance/infrastructure/balance.module';
import { ExpenseGroupModule } from './expense-group/infrastructure/expense-group.module';
import { FeedModule } from './feed/infrastructure/feed.module';
import { MemberModule } from './member/infrastructure/member.module';
import { PaymentModule } from './payment/infrastructure/payment.module';
import { PaymentShareModule } from './payment-share/infrastructure/payment-share.module';
import { SettlementModule } from './settlement/infrastructure/settlement.module';
import { AuthStateExceptionFilter } from './shared/http/auth-state-exception.filter';
import { InviteLinkExceptionFilter } from './shared/http/invite-link-exception.filter';
import { MemberExceptionFilter } from './shared/http/member-exception.filter';
import { PaymentExceptionFilter } from './shared/http/payment-exception.filter';
import { SessionExceptionFilter } from './shared/http/session-exception.filter';
import { SettlementExceptionFilter } from './shared/http/settlement-exception.filter';
import { UserModule } from './user/infrastructure/user.module';

@Module({
  imports: [
    AuthModule,
    BalanceModule,
    ConfigModule.forRoot(),
    ExpenseGroupModule,
    FeedModule,
    MemberModule,
    PaymentModule,
    PaymentShareModule,
    SettlementModule,
    UserModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: SessionExceptionFilter },
    { provide: APP_FILTER, useClass: InviteLinkExceptionFilter },
    { provide: APP_FILTER, useClass: AuthStateExceptionFilter },
    { provide: APP_FILTER, useClass: MemberExceptionFilter },
    { provide: APP_FILTER, useClass: PaymentExceptionFilter },
    { provide: APP_FILTER, useClass: SettlementExceptionFilter },
  ],
})
export class AppModule {}

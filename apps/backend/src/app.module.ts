import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/infrastructure/auth.module';
import { ExpenseGroupModule } from './expense-group/infrastructure/expense-group.module';
import { MemberModule } from './member/infrastructure/member.module';
import { PaymentModule } from './payment/infrastructure/payment.module';
import { PaymentShareModule } from './payment-share/infrastructure/payment-share.module';
import { UserModule } from './user/infrastructure/user.module';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot(),
    ExpenseGroupModule,
    MemberModule,
    PaymentModule,
    PaymentShareModule,
    UserModule,
  ],
})
export class AppModule {}

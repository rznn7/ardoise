import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './infrastructure/auth/auth.module';
import { ExpenseGroupModule } from './infrastructure/expense-group/expense-group.module';
import { MemberModule } from './infrastructure/member/member.module';
import { PaymentModule } from './infrastructure/payment/payment.module';
import { PaymentShareModule } from './infrastructure/payment-share/payment-share.module';
import { UserModule } from './infrastructure/user/user.module';

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

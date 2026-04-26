import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpenseGroupModule } from './infrastructure/expense-group/expense-group.module';
import { MemberModule } from './infrastructure/member/member.module';
import { PaymentModule } from './infrastructure/payment/payment.module';
import { PaymentShareModule } from './infrastructure/payment-share/payment-share.module';
import { UserModule } from './infrastructure/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    UserModule,
    ExpenseGroupModule,
    MemberModule,
    PaymentModule,
    PaymentShareModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

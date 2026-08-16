import { Module } from '@nestjs/common';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { PaymentModule } from 'src/payment/infrastructure/payment.module';
import { FindPaymentSharesByPaymentUseCase } from 'src/payment-share/application/find-payment-shares-by-payment.use-case';
import { PAYMENT_SHARE_REPOSITORY } from 'src/payment-share/domain/payment-share-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { PaymentShareController } from './payment-share.controller';
import { PaymentShareRepositoryDrizzle } from './payment-share-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, PaymentModule, MemberModule],
  providers: [
    {
      provide: PAYMENT_SHARE_REPOSITORY,
      useClass: PaymentShareRepositoryDrizzle,
    },
    FindPaymentSharesByPaymentUseCase,
  ],
  exports: [PAYMENT_SHARE_REPOSITORY],
  controllers: [PaymentShareController],
})
export class PaymentShareModule {}

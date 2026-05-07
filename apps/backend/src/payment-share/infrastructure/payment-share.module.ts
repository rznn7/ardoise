import { Module } from '@nestjs/common';
import { FindPaymentSharesByPaymentUseCase } from 'src/payment-share/application/find-payment-shares-by-payment.use-case';
import { PAYMENT_SHARE_REPOSITORY } from 'src/payment-share/domain/payment-share-repository';
import { DatabaseModule } from 'src/shared/database/database.module';

import { PaymentShareController } from './payment-share.controller';
import { PaymentShareRepositoryDrizzle } from './payment-share-repository.drizzle';

@Module({
  imports: [DatabaseModule],
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

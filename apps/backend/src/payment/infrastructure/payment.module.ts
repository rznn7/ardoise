import { Module } from '@nestjs/common';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { PAYMENT_REPOSITORY } from 'src/payment/domain/payment-repository';
import { DatabaseModule } from 'src/shared/database/database.module';

import { PaymentController } from './payment.controller';
import { PaymentRepositoryDrizzle } from './payment-repository.drizzle';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PAYMENT_REPOSITORY,
      useClass: PaymentRepositoryDrizzle,
    },
    FindPaymentUseCase,
  ],
  exports: [PAYMENT_REPOSITORY],
  controllers: [PaymentController],
})
export class PaymentModule {}

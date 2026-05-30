import { Module } from '@nestjs/common';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { PAYMENT_REPOSITORY } from 'src/payment/domain/payment-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';

import { PaymentController } from './payment.controller';
import { PaymentRepositoryDrizzle } from './payment-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule],
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

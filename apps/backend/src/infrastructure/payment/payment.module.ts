import { Module } from '@nestjs/common';
import { FindPaymentUseCase } from 'src/application/payment/find-payment.use-case';
import { PAYMENT_REPOSITORY } from 'src/domain/payment/payment-repository';
import { DatabaseModule } from '../database/database.module';
import { PaymentRepositoryDrizzle } from './payment-repository.drizzle';
import { PaymentController } from './payment.controller';

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

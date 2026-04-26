import { Module } from '@nestjs/common';
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
  ],
  exports: [PAYMENT_REPOSITORY],
  controllers: [PaymentController],
})
export class PaymentModule {}

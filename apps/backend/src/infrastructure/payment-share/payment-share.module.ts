import { Module } from '@nestjs/common';
import { PAYMENT_SHARE_REPOSITORY } from 'src/domain/payment-share/payment-share-repository';
import { DatabaseModule } from '../database/database.module';
import { PaymentShareRepositoryDrizzle } from './payment-share-repository.drizzle';
import { PaymentShareController } from './payment-share.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: PAYMENT_SHARE_REPOSITORY,
      useClass: PaymentShareRepositoryDrizzle,
    },
  ],
  exports: [PAYMENT_SHARE_REPOSITORY],
  controllers: [PaymentShareController],
})
export class PaymentShareModule {}

import { Module } from '@nestjs/common';
import { UNIT_OF_WORK } from 'src/auth/domain/unit-of-work';
import { MemberModule } from 'src/member/infrastructure/member.module';
import { CreatePaymentUseCase } from 'src/payment/application/create-payment.use-case';
import { DeletePaymentUseCase } from 'src/payment/application/delete-payment.use-case';
import { FindPaymentUseCase } from 'src/payment/application/find-payment.use-case';
import { UpdatePaymentUseCase } from 'src/payment/application/update-payment.use-case';
import { PAYMENT_REPOSITORY } from 'src/payment/domain/payment-repository';
import { SessionModule } from 'src/session/infrastructure/session.module';
import { DatabaseModule } from 'src/shared/database/database.module';
import { UnitOfWorkDrizzle } from 'src/shared/database/unit-of-work.drizzle';

import { PaymentController } from './payment.controller';
import { PaymentRepositoryDrizzle } from './payment-repository.drizzle';

@Module({
  imports: [DatabaseModule, SessionModule, MemberModule],
  providers: [
    {
      provide: PAYMENT_REPOSITORY,
      useClass: PaymentRepositoryDrizzle,
    },
    { provide: UNIT_OF_WORK, useClass: UnitOfWorkDrizzle },
    FindPaymentUseCase,
    CreatePaymentUseCase,
    UpdatePaymentUseCase,
    DeletePaymentUseCase,
  ],
  exports: [PAYMENT_REPOSITORY],
  controllers: [PaymentController],
})
export class PaymentModule {}

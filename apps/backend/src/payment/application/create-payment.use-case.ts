import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import {
  createPayment,
  type CreatePaymentInput,
} from 'src/payment/domain/create-payment';
import { type Payment } from 'src/payment/domain/payment';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';

@Injectable()
export class CreatePaymentUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  execute(
    input: CreatePaymentInput,
  ): Promise<{ payment: Payment; shares: PaymentShare[] }> {
    return this.uow.run((repos) => createPayment(repos, input));
  }
}

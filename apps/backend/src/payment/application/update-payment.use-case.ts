import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import { type Payment } from 'src/payment/domain/payment';
import {
  updatePayment,
  type UpdatePaymentInput,
} from 'src/payment/domain/update-payment';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';

@Injectable()
export class UpdatePaymentUseCase {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork) {}

  execute(
    input: UpdatePaymentInput,
  ): Promise<{ payment: Payment; shares: PaymentShare[] }> {
    return this.uow.run((repos) => updatePayment(repos, input));
  }
}

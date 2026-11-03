import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWork } from 'src/auth/domain/unit-of-work';
import {
  createPayment,
  type CreatePaymentInput,
} from 'src/payment/domain/create-payment';
import { type Payment } from 'src/payment/domain/payment';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';

@Injectable()
export class CreatePaymentUseCase {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute(
    input: CreatePaymentInput & { opId?: string },
  ): Promise<{ payment: Payment; shares: PaymentShare[] }> {
    const { opId, ...paymentInput } = input;
    const result = await this.uow.run((repos) =>
      createPayment(repos, paymentInput),
    );
    await this.realtime.groupChanged({
      type: 'payment.saved',
      payment: result.payment,
      opId,
    });
    return result;
  }
}

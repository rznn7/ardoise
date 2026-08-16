import { Inject, Injectable } from '@nestjs/common';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import {
  PAYMENT_SHARE_REPOSITORY,
  type PaymentShareRepository,
} from 'src/payment-share/domain/payment-share-repository';

@Injectable()
export class FindPaymentSharesByPaymentUseCase {
  constructor(
    @Inject(PAYMENT_SHARE_REPOSITORY)
    private readonly paymentShares: PaymentShareRepository,
  ) {}

  execute(paymentId: number): Promise<PaymentShare[]> {
    return this.paymentShares.findByPayment(paymentId);
  }
}

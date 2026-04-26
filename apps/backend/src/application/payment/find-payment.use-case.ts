import { Inject, Injectable } from '@nestjs/common';
import { type Payment } from 'src/domain/payment/payment';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from 'src/domain/payment/payment-repository';

@Injectable()
export class FindPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
  ) {}

  execute(id: number): Promise<Payment | null> {
    return this.payments.findById(id);
  }
}

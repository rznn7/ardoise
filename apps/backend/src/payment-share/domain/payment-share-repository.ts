import { type PaymentShare } from './payment-share';

export const PAYMENT_SHARE_REPOSITORY = Symbol('PAYMENT_SHARE_REPOSITORY');

export interface PaymentShareRepository {
  findByPayment(paymentId: number): Promise<PaymentShare[]>;
}

import { type PaymentResponse } from '@ardoise/shared';
import { type Payment } from 'src/payment/domain/payment';

export const toPaymentResponse = (payment: Payment): PaymentResponse => ({
  id: payment.id,
  payerMemberId: payment.payerMemberId,
  groupId: payment.groupId,
  title: payment.title,
  paidAt: payment.paidAt.toISOString(),
  fullAmount: payment.fullAmount,
  splitType: payment.splitType,
  createdAt: payment.createdAt.toISOString(),
});

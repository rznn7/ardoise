import { type PaymentShareResponse } from '@ardoise/shared';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';

export const toPaymentShareResponse = (
  share: PaymentShare,
): PaymentShareResponse => ({
  paymentId: share.paymentId,
  memberId: share.memberId,
  inputValue: share.inputValue,
  amount: share.amount,
});

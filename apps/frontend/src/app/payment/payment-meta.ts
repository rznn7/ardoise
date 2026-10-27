import { type GroupMember, type PaymentResponse, type SplitType } from '@ardoise/shared';

import { shortDay } from './day-label';

const SPLIT_LABELS: Readonly<Record<SplitType, string>> = {
  equal: 'Equally',
  shares: 'By shares',
  percent: 'By percentage',
  exact: 'Exact amounts',
};

export function paymentMeta(
  payment: Pick<PaymentResponse, 'payerMemberId' | 'paidAt' | 'splitType'>,
  members: readonly GroupMember[],
  meUserId: number,
): string {
  const payer = members.find((member) => member.id === payment.payerMemberId);
  const payerName = payer?.userId === meUserId ? 'you' : (payer?.name ?? 'someone');
  return [`Paid by ${payerName}`, shortDay(payment.paidAt), SPLIT_LABELS[payment.splitType]].join(
    ' · ',
  );
}

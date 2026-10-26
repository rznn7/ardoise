import { computePaymentShares } from '@ardoise/shared';
import { type MemberRepository } from 'src/member/domain/member-repository';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import { type PaymentShareRepository } from 'src/payment-share/domain/payment-share-repository';

import { assertPaymentMembers } from './assert-payment-members';
import { type CreatePaymentInput } from './create-payment';
import { type Payment, PaymentNotFound } from './payment';
import { type PaymentRepository } from './payment-repository';

export type UpdatePaymentInput = Omit<CreatePaymentInput, 'groupId'> & {
  readonly paymentId: number;
};

export const updatePayment = async (
  deps: {
    members: MemberRepository;
    payments: PaymentRepository;
    paymentShares: PaymentShareRepository;
  },
  input: UpdatePaymentInput,
): Promise<{ payment: Payment; shares: PaymentShare[] }> => {
  const existing = await deps.payments.findById(input.paymentId);
  if (!existing) throw new PaymentNotFound();

  const groupMembers = await deps.members.findByGroupId(existing.groupId);
  assertPaymentMembers(groupMembers, input);

  const computed = computePaymentShares({
    fullAmount: input.fullAmount,
    splitType: input.splitType,
    payerMemberId: input.payerMemberId,
    participants: input.participants,
  });

  const payment = await deps.payments.update(existing.id, {
    payerMemberId: input.payerMemberId,
    title: input.title,
    paidAt: input.paidAt,
    fullAmount: input.fullAmount,
    splitType: input.splitType,
  });

  await deps.paymentShares.deleteByPayment(payment.id);
  const shares = await deps.paymentShares.createMany(
    computed.map((share) => ({ ...share, paymentId: payment.id })),
  );

  return { payment, shares };
};

import {
  computePaymentShares,
  type SplitParticipant,
  type SplitType,
} from '@ardoise/shared';
import { type MemberRepository } from 'src/member/domain/member-repository';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import { type PaymentShareRepository } from 'src/payment-share/domain/payment-share-repository';

import { assertPaymentMembers } from './assert-payment-members';
import { type Payment } from './payment';
import { type PaymentRepository } from './payment-repository';

export type CreatePaymentInput = {
  readonly userId: number;
  readonly groupId: number;
  readonly payerMemberId: number;
  readonly title: string;
  readonly paidAt: Date;
  readonly fullAmount: number;
  readonly splitType: SplitType;
  readonly participants: readonly SplitParticipant[];
};

export const createPayment = async (
  deps: {
    members: MemberRepository;
    payments: PaymentRepository;
    paymentShares: PaymentShareRepository;
  },
  input: CreatePaymentInput,
): Promise<{ payment: Payment; shares: PaymentShare[] }> => {
  const groupMembers = await deps.members.findByGroupId(input.groupId);
  assertPaymentMembers(groupMembers, input);

  const computed = computePaymentShares({
    fullAmount: input.fullAmount,
    splitType: input.splitType,
    payerMemberId: input.payerMemberId,
    participants: input.participants,
  });

  const payment = await deps.payments.create({
    payerMemberId: input.payerMemberId,
    groupId: input.groupId,
    title: input.title,
    paidAt: input.paidAt,
    fullAmount: input.fullAmount,
    splitType: input.splitType,
  });

  const shares = await deps.paymentShares.createMany(
    computed.map((share) => ({ ...share, paymentId: payment.id })),
  );

  return { payment, shares };
};

import { NotAMember } from 'src/member/domain/member';
import { type MemberRepository } from 'src/member/domain/member-repository';
import { type PaymentShare } from 'src/payment-share/domain/payment-share';
import { type PaymentShareRepository } from 'src/payment-share/domain/payment-share-repository';

import {
  computePaymentShares,
  type SplitParticipant,
} from './compute-payment-shares';
import {
  ParticipantNotInGroup,
  PayerNotInGroup,
  type Payment,
  type SplitType,
} from './payment';
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
  const memberIds = new Set(groupMembers.map((m) => m.id));

  if (!groupMembers.some((m) => m.userId === input.userId))
    throw new NotAMember();
  if (!memberIds.has(input.payerMemberId)) throw new PayerNotInGroup();
  if (input.participants.some((p) => !memberIds.has(p.memberId)))
    throw new ParticipantNotInGroup();

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

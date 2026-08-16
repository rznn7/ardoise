import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import { type Payment } from 'src/payment/domain/payment';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from 'src/payment/domain/payment-repository';

@Injectable()
export class FindPaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    paymentId,
  }: {
    userId: number;
    paymentId: number;
  }): Promise<Payment> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundException();

    const membership = await this.members.findByUserAndGroup(
      userId,
      payment.groupId,
    );
    if (!membership) throw new NotAMember();

    return payment;
  }
}

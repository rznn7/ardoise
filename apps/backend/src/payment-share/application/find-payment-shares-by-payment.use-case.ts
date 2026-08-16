import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from 'src/payment/domain/payment-repository';
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
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
  ) {}

  async execute({
    userId,
    paymentId,
  }: {
    userId: number;
    paymentId: number;
  }): Promise<PaymentShare[]> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new NotFoundException();

    const membership = await this.members.findByUserAndGroup(
      userId,
      payment.groupId,
    );
    if (!membership) throw new NotAMember();

    return this.paymentShares.findByPayment(paymentId);
  }
}

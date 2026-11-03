import { Inject, Injectable } from '@nestjs/common';
import { NotAMember } from 'src/member/domain/member';
import {
  MEMBER_REPOSITORY,
  type MemberRepository,
} from 'src/member/domain/member-repository';
import { PaymentNotFound } from 'src/payment/domain/payment';
import {
  PAYMENT_REPOSITORY,
  type PaymentRepository,
} from 'src/payment/domain/payment-repository';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from 'src/realtime/domain/realtime-publisher';

@Injectable()
export class DeletePaymentUseCase {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(MEMBER_REPOSITORY) private readonly members: MemberRepository,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async execute({
    userId,
    paymentId,
    opId,
  }: {
    userId: number;
    paymentId: number;
    opId?: string;
  }): Promise<void> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new PaymentNotFound();

    const membership = await this.members.findByUserAndGroup(
      userId,
      payment.groupId,
    );
    if (!membership) throw new NotAMember();

    await this.payments.delete(paymentId);
    await this.realtime.groupChanged({
      type: 'payment.deleted',
      groupId: payment.groupId,
      id: paymentId,
      opId,
    });
  }
}

import { type MemberRepository } from 'src/member/domain/member-repository';
import { type PaymentShareRepository } from 'src/payment-share/domain/payment-share-repository';
import { describe, expect, it, vi } from 'vitest';

import { type Payment, PaymentNotFound } from './payment';
import { type PaymentRepository } from './payment-repository';
import { updatePayment } from './update-payment';

const stored: Payment = {
  id: 5,
  payerMemberId: 11,
  groupId: 7,
  title: 'Groceries',
  paidAt: new Date('2026-10-25T12:00:00.000Z'),
  fullAmount: 2450,
  splitType: 'equal',
  createdAt: new Date('2026-10-25T12:00:00.000Z'),
};

describe('updatePayment', () => {
  it('reports a payment deleted between the read and the write as not found', async () => {
    const members = {
      findByGroupId: () =>
        Promise.resolve([
          { id: 11, userId: 1, groupId: 7, nickname: null, isModerator: true },
        ]),
    } as unknown as MemberRepository;
    const payments = {
      findById: () => Promise.resolve(stored),
      update: () => Promise.resolve(null),
    } as unknown as PaymentRepository;
    const createMany = vi.fn<PaymentShareRepository['createMany']>();
    const paymentShares = {
      deleteByPayment: vi.fn<PaymentShareRepository['deleteByPayment']>(),
      createMany,
    } as unknown as PaymentShareRepository;

    await expect(
      updatePayment(
        { members, payments, paymentShares },
        {
          paymentId: 5,
          userId: 1,
          payerMemberId: 11,
          title: 'Market',
          paidAt: stored.paidAt,
          fullAmount: 3000,
          splitType: 'equal',
          participants: [{ memberId: 11, inputValue: 0 }],
        },
      ),
    ).rejects.toBeInstanceOf(PaymentNotFound);
    expect(createMany).not.toHaveBeenCalled();
  });
});

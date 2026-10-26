import { type SplitType } from '@ardoise/shared';

export type { SplitType };

export type Payment = {
  readonly id: number;
  readonly payerMemberId: number;
  readonly groupId: number;
  readonly title: string;
  readonly paidAt: Date;
  readonly fullAmount: number;
  readonly splitType: SplitType;
  readonly createdAt: Date;
};

export class PaymentNotFound extends Error {}
export class PayerNotInGroup extends Error {}
export class ParticipantNotInGroup extends Error {}

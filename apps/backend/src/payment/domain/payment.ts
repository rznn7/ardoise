export type SplitType = 'equal' | 'percent' | 'shares' | 'exact';

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

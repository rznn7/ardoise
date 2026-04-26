export type SplitType = 'equal' | 'percent' | 'shares' | 'exact';

export interface Payment {
  id: number;
  payerMemberId: number;
  expenseGroupId: number;
  title: string;
  paidAt: Date;
  fullAmount: number;
  splitType: SplitType;
  createdAt: Date;
}

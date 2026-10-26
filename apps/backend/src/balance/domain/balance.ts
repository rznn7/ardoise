export type MemberTotals = {
  readonly memberId: number;
  readonly paid: number;
  readonly owed: number;
};

export type MemberBalance = {
  readonly memberId: number;
  readonly amount: number;
};

export type Transfer = {
  readonly fromMemberId: number;
  readonly toMemberId: number;
  readonly amount: number;
};

export class UnbalancedLedger extends Error {}

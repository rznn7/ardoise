export type Settlement = {
  readonly id: number;
  readonly groupId: number;
  readonly fromMemberId: number;
  readonly toMemberId: number;
  readonly amount: number;
  readonly settledAt: Date;
  readonly createdByMemberId: number;
  readonly createdAt: Date;
};

type Parties = {
  readonly fromMemberId: number;
  readonly toMemberId: number;
};

export class InvalidSettlement extends Error {}
export class SettlementMemberNotInGroup extends Error {}
export class NotInvolvedInSettlement extends Error {}
export class SettlementNotFound extends Error {}

export const assertValidSettlement = (
  input: Parties & { readonly amount: number },
): void => {
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new InvalidSettlement();
  if (input.fromMemberId === input.toMemberId) throw new InvalidSettlement();
};

export const assertInvolved = (
  settlement: Parties,
  actorMemberId: number,
): void => {
  if (
    settlement.fromMemberId !== actorMemberId &&
    settlement.toMemberId !== actorMemberId
  )
    throw new NotInvolvedInSettlement();
};

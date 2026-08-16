import { type PaymentShare } from 'src/payment-share/domain/payment-share';

import { apportion, type Weighted } from './apportion';
import { type SplitType } from './payment';

export type SplitParticipant = {
  readonly memberId: number;
  readonly inputValue: number;
};

export type ComputeSharesInput = {
  readonly fullAmount: number;
  readonly splitType: SplitType;
  readonly payerMemberId: number;
  readonly participants: readonly SplitParticipant[];
};

export type ComputedShare = Omit<PaymentShare, 'paymentId'>;

export type InvalidSplitCode =
  | 'EMPTY_PARTICIPANTS'
  | 'NON_POSITIVE_AMOUNT'
  | 'NON_INTEGER_VALUE'
  | 'DUPLICATE_PARTICIPANT'
  | 'NEGATIVE_INPUT_VALUE'
  | 'PERCENT_TOTAL_MISMATCH'
  | 'EXACT_TOTAL_MISMATCH'
  | 'ZERO_TOTAL_WEIGHT'
  | 'SHARE_WEIGHT_TOO_LARGE';

export class InvalidSplit extends Error {
  constructor(readonly code: InvalidSplitCode) {
    super(code);
  }
}

const PERCENT_TOTAL = 10_000;
export const MAX_SHARE_WEIGHT = 1_000_000;

const sumOf = (participants: readonly SplitParticipant[]): number =>
  participants.reduce((total, p) => total + p.inputValue, 0);

const toWeights = (
  splitType: Exclude<SplitType, 'exact'>,
  participants: readonly SplitParticipant[],
): readonly Weighted[] =>
  participants.map((p) => ({
    memberId: p.memberId,
    weight: splitType === 'equal' ? 1 : p.inputValue,
  }));

export const computePaymentShares = (
  input: ComputeSharesInput,
): readonly ComputedShare[] => {
  const { fullAmount, splitType, payerMemberId, participants } = input;

  if (participants.length === 0) throw new InvalidSplit('EMPTY_PARTICIPANTS');
  if (fullAmount <= 0) throw new InvalidSplit('NON_POSITIVE_AMOUNT');
  if (
    !Number.isInteger(fullAmount) ||
    participants.some((p) => !Number.isInteger(p.inputValue))
  ) {
    throw new InvalidSplit('NON_INTEGER_VALUE');
  }

  const memberIds = participants.map((p) => p.memberId);
  if (new Set(memberIds).size !== memberIds.length) {
    throw new InvalidSplit('DUPLICATE_PARTICIPANT');
  }

  if (splitType !== 'equal' && participants.some((p) => p.inputValue < 0)) {
    throw new InvalidSplit('NEGATIVE_INPUT_VALUE');
  }

  if (splitType === 'exact') {
    if (sumOf(participants) !== fullAmount) {
      throw new InvalidSplit('EXACT_TOTAL_MISMATCH');
    }
    return withVerifiedTotal(
      participants.map((p) => ({
        memberId: p.memberId,
        inputValue: p.inputValue,
        amount: p.inputValue,
      })),
      fullAmount,
    );
  }

  if (splitType === 'percent' && sumOf(participants) !== PERCENT_TOTAL) {
    throw new InvalidSplit('PERCENT_TOTAL_MISMATCH');
  }
  if (splitType === 'shares' && sumOf(participants) === 0) {
    throw new InvalidSplit('ZERO_TOTAL_WEIGHT');
  }
  if (
    splitType === 'shares' &&
    participants.some((p) => p.inputValue > MAX_SHARE_WEIGHT)
  ) {
    throw new InvalidSplit('SHARE_WEIGHT_TOO_LARGE');
  }

  const amountByMember = new Map(
    apportion(
      fullAmount,
      toWeights(splitType, participants),
      payerMemberId,
    ).map((share) => [share.memberId, share.amount]),
  );

  const shares = participants.map((p) => ({
    memberId: p.memberId,
    inputValue: splitType === 'equal' ? 0 : p.inputValue,
    amount: amountByMember.get(p.memberId) ?? 0,
  }));

  return withVerifiedTotal(shares, fullAmount);
};

const withVerifiedTotal = (
  shares: readonly ComputedShare[],
  fullAmount: number,
): readonly ComputedShare[] => {
  const total = shares.reduce((sum, s) => sum + s.amount, 0);
  if (total !== fullAmount) {
    throw new Error(
      `computePaymentShares produced shares summing to ${String(total)}, expected ${String(fullAmount)}`,
    );
  }
  return shares;
};

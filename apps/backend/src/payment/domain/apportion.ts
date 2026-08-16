export type Weighted = {
  readonly memberId: number;
  readonly weight: number;
};

/** Precondition: totalWeight > 0. Throws nothing. */
export const apportion = (
  fullAmount: number,
  weights: readonly Weighted[],
  payerMemberId: number,
): readonly { memberId: number; amount: number }[] => {
  const totalWeight = weights.reduce((total, w) => total + w.weight, 0);

  const floors = weights.map((w) => ({
    memberId: w.memberId,
    amount: Math.floor((fullAmount * w.weight) / totalWeight),
    remainder: (fullAmount * w.weight) % totalWeight,
  }));

  const leftover =
    fullAmount - floors.reduce((total, f) => total + f.amount, 0);

  const priority = [...floors].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      Number(b.memberId === payerMemberId) -
        Number(a.memberId === payerMemberId) ||
      a.memberId - b.memberId,
  );
  const getsExtraCent = new Set(
    priority.slice(0, Math.max(0, leftover)).map((f) => f.memberId),
  );

  return floors.map((f) => ({
    memberId: f.memberId,
    amount: f.amount + (getsExtraCent.has(f.memberId) ? 1 : 0),
  }));
};

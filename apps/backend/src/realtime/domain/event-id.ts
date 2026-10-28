export interface EventId {
  readonly boot: string;
  readonly seq: number;
}

export const formatEventId = (boot: string, seq: number): string =>
  `${boot}.${String(seq)}`;

export const parseEventId = (raw: string): EventId | null => {
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [boot, rawSeq] = parts;
  if (!boot || !rawSeq || !/^\d+$/.test(rawSeq)) return null;
  const seq = Number(rawSeq);
  return Number.isSafeInteger(seq) ? { boot, seq } : null;
};

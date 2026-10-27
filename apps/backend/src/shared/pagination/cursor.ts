export const PAGE_SIZE = 50;

export interface Cursor {
  readonly date: Date;
  readonly rank: 0 | 1;
  readonly id: number;
}

export class InvalidCursor extends Error {}

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(
    JSON.stringify([cursor.date.toISOString(), cursor.rank, cursor.id]),
  ).toString('base64url');

const parse = (raw: string): unknown => {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursor();
  }
};

export const decodeCursor = (raw: string): Cursor => {
  const value = parse(raw);
  if (!Array.isArray(value) || value.length !== 3) throw new InvalidCursor();
  const [iso, rank, id]: unknown[] = value;
  const date = typeof iso === 'string' ? new Date(iso) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new InvalidCursor();
  if (rank !== 0 && rank !== 1) throw new InvalidCursor();
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
    throw new InvalidCursor();
  }
  return { date, rank, id };
};

export const isAfter = (cursor: Cursor, item: Cursor): boolean =>
  item.date.getTime() < cursor.date.getTime() ||
  (item.date.getTime() === cursor.date.getTime() &&
    (item.rank > cursor.rank ||
      (item.rank === cursor.rank && item.id < cursor.id)));

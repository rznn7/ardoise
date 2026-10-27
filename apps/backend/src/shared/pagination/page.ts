import { type Cursor, encodeCursor } from './cursor';

export interface Page<T> {
  readonly items: T[];
  readonly nextCursor: string | null;
}

export const toPage = <T>(
  fetched: T[],
  size: number,
  cursorOf: (item: T) => Cursor,
): Page<T> => {
  const items = fetched.slice(0, size);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      fetched.length > size && last ? encodeCursor(cursorOf(last)) : null,
  };
};

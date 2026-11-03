import { parseEventId } from './event-id';

export const replayAfter = <T extends { readonly seq: number }>(
  buffer: readonly T[],
  current: number,
  boot: string,
  lastEventId: string | undefined,
): readonly T[] | 'reset' => {
  if (lastEventId === undefined) return [];
  const last = parseEventId(lastEventId);
  if (!last || last.boot !== boot || last.seq > current) return 'reset';
  if (last.seq === current) return [];
  const [oldest] = buffer;
  if (!oldest || oldest.seq > last.seq + 1) return 'reset';
  return buffer.filter((entry) => entry.seq > last.seq);
};

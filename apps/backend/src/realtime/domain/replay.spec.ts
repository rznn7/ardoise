import { describe, expect, it } from 'vitest';

import { formatEventId, parseEventId } from './event-id';
import { replayAfter } from './replay';

const boot = 'boot-a';
const entry = (seq: number) => ({ seq });
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => entry(from + index));
const id = (seq: number, bootId = boot) => formatEventId(bootId, seq);

describe('event ids', () => {
  it('round-trips through format and parse', () => {
    expect(parseEventId(formatEventId('abc', 12))).toEqual({
      boot: 'abc',
      seq: 12,
    });
  });

  it.each(['garbage', 'b.-1', 'b.1.2', 'b.', '.1', 'b.1.5', 'b.x', 'b.1.5e1'])(
    'rejects %s',
    (raw) => {
      expect(parseEventId(raw)).toBeNull();
    },
  );
});

describe('replayAfter', () => {
  it('replays nothing without a last event id', () => {
    expect(replayAfter(range(5, 9), 9, boot, undefined)).toEqual([]);
  });

  it.each(['garbage', 'b.-1', 'b.1.2'])('resets on %s', (raw) => {
    expect(replayAfter(range(5, 9), 9, boot, raw)).toBe('reset');
  });

  it('resets when the id comes from another boot', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(7, 'boot-b'))).toBe('reset');
  });

  it('replays nothing when the client is up to date', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(9))).toEqual([]);
  });

  it('resets when the client is ahead of the server', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(10))).toBe('reset');
  });

  it('replays the entries after the last seen one', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(6))).toEqual(range(7, 9));
  });

  it('replays the whole buffer when nothing was lost', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(4))).toEqual(range(5, 9));
  });

  it('resets when the next entry was evicted', () => {
    expect(replayAfter(range(5, 9), 9, boot, id(3))).toBe('reset');
  });

  it('replays nothing for an empty buffer at zero', () => {
    expect(replayAfter([], 0, boot, id(0))).toEqual([]);
  });
});

import { type RealtimeMessage, realtimeMessageSchema } from '@ardoise/shared';

export type SseMessage = { id: string | undefined; data: RealtimeMessage };

export type SseClient = {
  next(timeoutMs?: number): Promise<SseMessage>;
  nothing(ms: number): Promise<void>;
  ended: Promise<void>;
  close(): void;
};

const parseFrame = (frame: string): SseMessage | null => {
  let id: string | undefined;
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('id:')) id = line.slice(3).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (data.length === 0) return null;
  return { id, data: realtimeMessageSchema.parse(JSON.parse(data.join('\n'))) };
};

export async function openStream(
  baseUrl: string,
  cookie: string,
  lastEventId?: string,
): Promise<SseClient> {
  const controller = new AbortController();
  const headers: Record<string, string> = {
    cookie,
    accept: 'text/event-stream',
  };
  if (lastEventId !== undefined) headers['last-event-id'] = lastEventId;

  const response = await fetch(`${baseUrl}/events`, {
    headers,
    signal: controller.signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`stream refused with ${String(response.status)}`);
  }

  const queue: SseMessage[] = [];
  const waiters: Array<() => void> = [];
  const wake = () => {
    for (const waiter of waiters.splice(0)) waiter();
  };

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const ended = (async () => {
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += value;
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const message = parseFrame(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          if (message && message.data.type !== 'ping') queue.push(message);
          boundary = buffer.indexOf('\n\n');
        }
        wake();
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      wake();
    }
  })();

  let isEnded = false;
  void ended.then(
    () => {
      isEnded = true;
    },
    () => {
      isEnded = true;
    },
  );

  const waitForMessage = (timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      const waiter = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(waiter), 1);
        reject(new Error(`no message within ${String(timeoutMs)}ms`));
      }, timeoutMs);
      waiters.push(waiter);
    });

  return {
    async next(timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const message = queue.shift();
        if (message) return message;
        if (isEnded) throw new Error('stream ended');
        await waitForMessage(Math.max(deadline - Date.now(), 0));
      }
    },
    async nothing(ms) {
      await new Promise((resolve) => setTimeout(resolve, ms));
      if (isEnded) throw new Error('stream ended');
      const [unexpected] = queue;
      if (unexpected) {
        throw new Error(
          `unexpected message ${JSON.stringify(unexpected.data)}`,
        );
      }
    },
    ended,
    close() {
      controller.abort();
    },
  };
}

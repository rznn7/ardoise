import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedSession, seedUser } from './helpers/seed';
import { openStream, type SseClient } from './helpers/sse';
import { setupTestApp } from './helpers/test-app';

describe('Realtime stream', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;
  let baseUrl: string;
  const streams: SseClient[] = [];

  const signIn = async () => {
    const { id: userId } = await seedUser(pgClient);
    const { token } = await seedSession(pgClient, { userId });
    return `session_token=${token}`;
  };

  const connect = async (cookie: string, lastEventId?: string) => {
    const stream = await openStream(baseUrl, cookie, lastEventId);
    streams.push(stream);
    return stream;
  };

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 30000);

  afterEach(async () => {
    for (const stream of streams.splice(0)) stream.close();
    await pgClient.query(`TRUNCATE session, users RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  it('refuses a visitor without a session', async () => {
    await request(app.getHttpServer()).get('/events').expect(401);
  });

  it('opens with ready and the current event id', async () => {
    const stream = await connect(await signIn());

    const first = await stream.next();

    expect(first.data).toEqual({ type: 'ready' });
    expect(first.id).toMatch(/^[a-z0-9]+\.\d+$/);
  });

  it('resets a client whose last id comes from another boot', async () => {
    const stream = await connect(await signIn(), 'zzz.0');

    const first = await stream.next();

    expect(first.data).toEqual({ type: 'reset' });
  });

  it('resumes quietly a client that is up to date', async () => {
    const cookie = await signIn();
    const { id: readyId } = await (await connect(cookie)).next();

    const stream = await connect(cookie, readyId);

    expect((await stream.next()).data).toEqual({ type: 'ready' });
    await stream.nothing(300);
  });
});

describe('Realtime stream on shutdown', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
    await app.listen(0);
  }, 30000);

  afterAll(async () => {
    await pgClient.end();
    await pgContainer.stop();
  });

  it('closes promptly and ends the stream while a client is still connected', async () => {
    const { id: userId } = await seedUser(pgClient);
    const { token } = await seedSession(pgClient, { userId });
    const stream = await openStream(
      await app.getUrl(),
      `session_token=${token}`,
    );
    await stream.next();

    const closing = app.close();

    await expect(
      Promise.race([
        closing.then(() => 'closed'),
        new Promise((resolve) =>
          setTimeout(() => {
            resolve('hung');
          }, 3000),
        ),
      ]),
    ).resolves.toBe('closed');
    await expect(
      stream.ended.then(
        () => 'over',
        () => 'over',
      ),
    ).resolves.toBe('over');
  });
});

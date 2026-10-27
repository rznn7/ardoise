import { adminApi } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

const routes = Object.entries(adminApi).map(([name, endpoint]) => ({
  name,
  method: endpoint.method,
  path: endpoint.path.replace(/:\w+/g, '1'),
}));

describe('Admin access', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(`TRUNCATE session, users RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const call = (method: string, path: string) =>
    method === 'GET'
      ? request(app.getHttpServer()).get(path)
      : request(app.getHttpServer()).post(path);

  it.each(routes)('$name refuses a plain user', async ({ method, path }) => {
    const lea = await seedUser(pgClient, { name: 'Léa' });
    await seedSession(pgClient, { userId: lea.id, token: 'lea-token' });

    const response = await call(method, path)
      .set('Cookie', 'session_token=lea-token')
      .expect(403);

    expect(response.body).toEqual({ error: 'NOT_AN_ADMIN' });
  });

  it.each(routes)(
    '$name refuses a visitor without a session',
    async ({ method, path }) => {
      await call(method, path).expect(401);
    },
  );
});

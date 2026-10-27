import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('FindUser', () => {
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

  it('returns 401 without a cookie', async () => {
    await request(app.getHttpServer()).get('/users/1').expect(401);
  });

  it('returns the user without their WebAuthn handle', async () => {
    const { id: userId } = await seedUser(pgClient, { name: 'alice' });
    const { token } = await seedSession(pgClient, { userId });

    const response = await request(app.getHttpServer())
      .get(`/users/${String(userId)}`)
      .set('Cookie', `session_token=${token}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      id: userId,
      name: 'alice',
      role: 'user',
    });
  });

  it('returns 404 for an unknown user', async () => {
    const { id: userId } = await seedUser(pgClient, { name: 'alice' });
    const { token } = await seedSession(pgClient, { userId });

    await request(app.getHttpServer())
      .get('/users/999999')
      .set('Cookie', `session_token=${token}`)
      .expect(404);
  });
});

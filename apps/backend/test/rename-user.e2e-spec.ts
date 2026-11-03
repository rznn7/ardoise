import { type MeResponse } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('Rename user', () => {
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

  const signedIn = async () => {
    const { id } = await seedUser(pgClient, { name: 'user-1234' });
    const { token } = await seedSession(pgClient, { userId: id });
    return { id, cookie: `session_token=${token}` };
  };

  const storedName = async (id: number) =>
    (
      await pgClient.query<{ name: string }>(
        `SELECT name FROM users WHERE id = $1`,
        [id],
      )
    ).rows[0]?.name;

  it('renames me', async () => {
    // GIVEN
    const { id, cookie } = await signedIn();

    // WHEN
    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookie)
      .send({ name: 'Gabriel' })
      .expect(200);

    // THEN
    expect(response.body).toEqual({ id, name: 'Gabriel', role: 'user' });
    const me = await request(app.getHttpServer())
      .post('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as MeResponse).name).toBe('Gabriel');
  });

  it('trims the name', async () => {
    // GIVEN
    const { id, cookie } = await signedIn();

    // WHEN
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookie)
      .send({ name: '  Gabriel  ' })
      .expect(200);

    // THEN
    expect(await storedName(id)).toBe('Gabriel');
  });

  it('refuses a blank name', async () => {
    // GIVEN
    const { id, cookie } = await signedIn();

    // WHEN
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookie)
      .send({ name: '   ' })
      .expect(400);

    // THEN
    expect(await storedName(id)).toBe('user-1234');
  });

  it('refuses a name over 50 characters', async () => {
    // GIVEN
    const { id, cookie } = await signedIn();

    // WHEN
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookie)
      .send({ name: 'a'.repeat(51) })
      .expect(400);

    // THEN
    expect(await storedName(id)).toBe('user-1234');
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Cookie', cookie)
      .send({ name: 'a'.repeat(50) })
      .expect(200);
  });

  it('refuses without a session', async () => {
    // WHEN / THEN
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ name: 'Gabriel' })
      .expect(401);
  });
});

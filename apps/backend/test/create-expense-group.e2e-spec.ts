import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('CreateExpenseGroup', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  describe('create', () => {
    it('returns 401 without a cookie', async () => {
      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/expense-groups')
        .send({ name: 'Trip', currencyCode: 'EUR' })
        .expect(401);
    });

    it('returns 400 when the body is invalid', async () => {
      // GIVEN a valid session.
      const { id: userId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId });

      // WHEN / THEN — name is missing.
      await request(app.getHttpServer())
        .post('/expense-groups')
        .set('Cookie', `session_token=${token}`)
        .send({ currencyCode: 'EUR' })
        .expect(400);
    });

    it('returns 201 with the created group summary', async () => {
      // GIVEN a valid session.
      const { id: userId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId });

      // WHEN
      const response = await request(app.getHttpServer())
        .post('/expense-groups')
        .set('Cookie', `session_token=${token}`)
        .send({ name: 'Trip', currencyCode: 'USD' })
        .expect(201);

      // THEN — the summary mirrors the persisted row, with an ISO-8601 createdAt
      // (not the raw domain entity's Date).
      const { id, created_at: createdAt } = (
        await pgClient.query<{ id: number; created_at: Date }>(
          `SELECT id, created_at FROM expense_group`,
        )
      ).rows[0]!;
      expect(response.body).toEqual({
        id,
        name: 'Trip',
        currencyCode: 'USD',
        createdAt: createdAt.toISOString(),
      });
    });
  });
});

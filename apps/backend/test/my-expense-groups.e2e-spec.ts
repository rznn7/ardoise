import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { setupTestApp } from './helpers/test-app';

describe('MyExpenseGroups', () => {
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

  describe('list-mine', () => {
    it('returns 401 without a cookie', async () => {
      // WHEN / THEN
      await request(app.getHttpServer()).get('/expense-groups').expect(401);
    });

    it('returns only the caller groups', async () => {
      // GIVEN user A with a valid session; groups G1, G2, G3; A member of G1 and G3 (not G2).
      const userAId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['alice', 'webauthn-alice'],
        )
      ).rows[0]!.id;
      await pgClient.query(
        `INSERT INTO session (token, user_id, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
        ['alice-session', userAId],
      );
      const g1 = (
        await pgClient.query<{ id: number; created_at: Date }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id, created_at`,
          ['G1', 'EUR'],
        )
      ).rows[0]!;
      // G2 — A is not a member, must be absent from the response.
      await pgClient.query(
        `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2)`,
        ['G2', 'USD'],
      );
      const g3 = (
        await pgClient.query<{ id: number; created_at: Date }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id, created_at`,
          ['G3', 'GBP'],
        )
      ).rows[0]!;
      await pgClient.query(
        `INSERT INTO member (user_id, group_id) VALUES ($1, $2), ($1, $3)`,
        [userAId, g1.id, g3.id],
      );

      // WHEN
      const response = await request(app.getHttpServer())
        .get('/expense-groups')
        .set('Cookie', `session_token=alice-session`)
        .expect(200);

      // THEN — ordered by id, G2 absent, createdAt an ISO-8601 string.
      expect(response.body).toEqual([
        {
          id: g1.id,
          name: 'G1',
          currencyCode: 'EUR',
          createdAt: g1.created_at.toISOString(),
        },
        {
          id: g3.id,
          name: 'G3',
          currencyCode: 'GBP',
          createdAt: g3.created_at.toISOString(),
        },
      ]);
    });

    it('returns empty array when caller has no groups', async () => {
      // GIVEN user A with a valid session and no membership; one group G1 exists.
      const userAId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['alice', 'webauthn-alice'],
        )
      ).rows[0]!.id;
      await pgClient.query(
        `INSERT INTO session (token, user_id, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
        ['alice-session', userAId],
      );
      await pgClient.query(
        `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2)`,
        ['G1', 'EUR'],
      );

      // WHEN
      const response = await request(app.getHttpServer())
        .get('/expense-groups')
        .set('Cookie', `session_token=alice-session`)
        .expect(200);

      // THEN
      expect(response.body).toEqual([]);
    });
  });
});

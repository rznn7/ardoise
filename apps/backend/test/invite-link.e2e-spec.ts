import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { setupTestApp } from './helpers/test-app';

describe('InviteLink', () => {
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
      await request(app.getHttpServer()).post('/invite-link').expect(401);
    });

    it('returns 401 for a revoked session', async () => {
      // GIVEN
      const { rows } = await pgClient.query<{ id: number }>(
        `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
        ['john', 'webauthn-test'],
      );
      await pgClient.query(
        `INSERT INTO session (token, user_id, issued_at, expires_at, revoked_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 minute')`,
        ['revoked-session-token', rows[0]!.id],
      );

      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=revoked-session-token`)
        .send({
          groupId: 1,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          singleUse: true,
        })
        .expect(401);
    });

    it('creates an invite link for a valid session', async () => {
      // GIVEN
      const { rows } = await pgClient.query<{ id: number }>(
        `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
        ['john', 'webauthn-test'],
      );
      await pgClient.query(
        `INSERT INTO session (token, user_id, issued_at, expires_at) VALUES ($1, $2, NOW(), NOW() + INTERVAL '7 days')`,
        ['valid-session-token', rows[0]!.id],
      );
      const groupId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id`,
          ['group', 'EUR'],
        )
      ).rows[0]!.id;

      // WHEN
      const response = await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=valid-session-token`)
        .send({
          groupId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          singleUse: true,
        })
        .expect(201);

      // THEN
      const body = response.body as { token: string };
      expect(body.token).toBeTypeOf('string');
      expect(body.token.length).toBeGreaterThan(0);

      const inviteRow = (
        await pgClient.query<{
          token: string;
          group_id: number;
          single_use: boolean;
          consumed_at: Date | null;
        }>(`SELECT * FROM invite_link WHERE token = $1`, [body.token])
      ).rows[0]!;
      expect(inviteRow).toMatchObject({
        group_id: groupId,
        single_use: true,
        consumed_at: null,
      });
    });
  });
});

import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { setupTestApp } from './helpers/test-app';

describe('GroupMembers', () => {
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

  describe('list-by-group', () => {
    it('returns 401 without a cookie', async () => {
      // WHEN / THEN
      await request(app.getHttpServer())
        .get('/expense-groups/1/members')
        .expect(401);
    });

    it('returns 403 when the caller is not a member', async () => {
      // GIVEN user A with a valid session; group G1 with members B and C (not A).
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
      const userBId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['bob', 'webauthn-bob'],
        )
      ).rows[0]!.id;
      const userCId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['carol', 'webauthn-carol'],
        )
      ).rows[0]!.id;
      const groupId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id`,
          ['group', 'EUR'],
        )
      ).rows[0]!.id;
      await pgClient.query(
        `INSERT INTO member (user_id, group_id) VALUES ($1, $2), ($3, $2)`,
        [userBId, groupId, userCId],
      );

      // WHEN / THEN
      await request(app.getHttpServer())
        .get(`/expense-groups/${groupId}/members`)
        .set('Cookie', `session_token=alice-session`)
        .expect(403);
    });

    it('returns 403 for a non-existent group', async () => {
      // GIVEN user A with a valid session and no groups.
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

      // WHEN / THEN — a non-existent group is indistinguishable from "not a member".
      const response = await request(app.getHttpServer())
        .get('/expense-groups/999999/members')
        .set('Cookie', `session_token=alice-session`)
        .expect(403);
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('returns all members when the caller belongs to the group', async () => {
      // GIVEN user A with a valid session; group G1 with members A, B, C
      //   (B nickname "Bob", C isModerator true).
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
      const userBId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['bob', 'webauthn-bob'],
        )
      ).rows[0]!.id;
      const userCId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO users (name, webauthn_user_id) VALUES ($1, $2) RETURNING id`,
          ['carol', 'webauthn-carol'],
        )
      ).rows[0]!.id;
      const groupId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO expense_group (name, currency_code) VALUES ($1, $2) RETURNING id`,
          ['group', 'EUR'],
        )
      ).rows[0]!.id;
      const memberAId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO member (user_id, group_id) VALUES ($1, $2) RETURNING id`,
          [userAId, groupId],
        )
      ).rows[0]!.id;
      const memberBId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO member (user_id, group_id, nickname) VALUES ($1, $2, $3) RETURNING id`,
          [userBId, groupId, 'Bob'],
        )
      ).rows[0]!.id;
      const memberCId = (
        await pgClient.query<{ id: number }>(
          `INSERT INTO member (user_id, group_id, is_moderator) VALUES ($1, $2, $3) RETURNING id`,
          [userCId, groupId, true],
        )
      ).rows[0]!.id;

      // WHEN
      const response = await request(app.getHttpServer())
        .get(`/expense-groups/${groupId}/members`)
        .set('Cookie', `session_token=alice-session`)
        .expect(200);

      // THEN — ordered by member id, no groupId leaked.
      expect(response.body).toEqual([
        { id: memberAId, userId: userAId, nickname: null, isModerator: false },
        { id: memberBId, userId: userBId, nickname: 'Bob', isModerator: false },
        { id: memberCId, userId: userCId, nickname: null, isModerator: true },
      ]);
    });

    it('returns 401 (not 400) for unauthenticated + malformed groupId', async () => {
      // WHEN GET /expense-groups/abc/members with no cookie (auth precedes validation).
      // THEN 401 — SessionGuard runs before ParseIntPipe, so the malformed id never 400s.
      await request(app.getHttpServer())
        .get('/expense-groups/abc/members')
        .expect(401);
    });
  });
});

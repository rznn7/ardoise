import {
  type BeginLoginResponse,
  type BeginRegistrationResponse,
} from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import { PASSKEY_VERIFIER } from 'src/auth/domain/passkey-verifier';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { fakePasskeyVerifier } from './helpers/fake-passkey-verifier';
import {
  seedGroup,
  seedInviteLink,
  seedPasskey,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('Authentication', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp({
      overrides: (b) =>
        b.overrideProvider(PASSKEY_VERIFIER).useValue(fakePasskeyVerifier),
    }));
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member, registration_state, login_state RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  describe('register', () => {
    it('registers', async () => {
      // GIVEN
      const { id: firstGroupId } = await seedGroup(pgClient, {
        name: 'summer trip 2026',
      });
      await seedInviteLink(pgClient, {
        groupId: firstGroupId,
        token: 'registration-token-1',
      });

      // WHEN
      const beginResponse = await request(app.getHttpServer())
        .post('/auth/register/begin')
        .send({ inviteToken: 'registration-token-1' })
        .expect(200);

      const beginBody = beginResponse.body as BeginRegistrationResponse;

      await request(app.getHttpServer())
        .post('/auth/register/complete')
        .send({
          stateId: beginBody.stateId,
          attestation: {},
        })
        .expect(204);

      // THEN
      const createdUser = (
        await pgClient.query<{ id: number }>(`SELECT * FROM users`)
      ).rows[0]!;
      expect(createdUser).toMatchObject({
        role: 'user',
      });

      const createdPasskey = (
        await pgClient.query<object>(`SELECT * FROM passkey`)
      ).rows[0]!;
      expect(createdPasskey).toMatchObject({
        user_id: createdUser.id,
        credential_id: 'cred-1',
        counter: 0,
        last_used_at: null,
      });

      const createdMember = (
        await pgClient.query<object>(`SELECT * FROM member`)
      ).rows[0]!;
      expect(createdMember).toMatchObject({
        user_id: createdUser.id,
        group_id: firstGroupId,
        nickname: null,
        is_moderator: false,
      });

      const consumedInvite = (
        await pgClient.query<{ consumed_at: string }>(
          `SELECT * FROM invite_link`,
        )
      ).rows[0]!;
      expect(consumedInvite).toMatchObject({
        consumed_by_user_id: createdUser.id,
      });
      expect(consumedInvite.consumed_at).not.toBeNull();
    });

    it('rejects an invalid invite token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register/begin')
        .send({ inviteToken: 'does-not-exist' })
        .expect(400);
    });

    it('rejects an unknown stateId on complete', async () => {
      await request(app.getHttpServer())
        .post('/auth/register/complete')
        .send({ stateId: 'made-up-state-id', attestation: {} })
        .expect(400);
    });

    it('rejects a replayed stateId after successful registration', async () => {
      // GIVEN
      const { id: groupId } = await seedGroup(pgClient);
      await seedInviteLink(pgClient, { groupId, token: 'replay-token' });

      const beginResponse = await request(app.getHttpServer())
        .post('/auth/register/begin')
        .send({ inviteToken: 'replay-token' })
        .expect(200);
      const { stateId } = beginResponse.body as BeginRegistrationResponse;

      await request(app.getHttpServer())
        .post('/auth/register/complete')
        .send({ stateId, attestation: {} })
        .expect(204);

      // WHEN: replay the same stateId
      await request(app.getHttpServer())
        .post('/auth/register/complete')
        .send({ stateId, attestation: {} })
        .expect(400);
    });

    it('rejects a consumed invite token', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient);
      const { id: groupId } = await seedGroup(pgClient);
      await seedInviteLink(pgClient, {
        groupId,
        token: 'consumed-token',
        consumedByUserId: userId,
      });

      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/auth/register/begin')
        .send({ inviteToken: 'consumed-token' })
        .expect(400);
    });
  });

  describe('login', () => {
    it('logs in', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient, {
        webauthnUserId: 'webauthn-test',
      });
      await seedPasskey(pgClient, { userId });

      // WHEN
      const beginResponse = await request(app.getHttpServer())
        .post('/auth/login/begin')
        .expect(200);
      const beginResponseBody = beginResponse.body as BeginLoginResponse;
      const completeResponse = await request(app.getHttpServer())
        .post('/auth/login/complete')
        .send({
          stateId: beginResponseBody.stateId,
          assertion: { id: 'cred-1' },
        })
        .expect(204);

      // THEN
      const setCookie = completeResponse.headers['set-cookie']![0]!;
      expect(setCookie).toMatch(/session_token=/);

      const tokenMatch = setCookie.match(/session_token=([^;]+)/);
      expect(tokenMatch).not.toBeNull();
      const token = tokenMatch![1]!;

      const sessionRow = (
        await pgClient.query<object>(`SELECT * FROM session WHERE token=$1`, [
          token,
        ])
      ).rows[0]!;
      expect(sessionRow).toMatchObject({
        user_id: userId,
        revoked_at: null,
      });

      const passkeyRow = (
        await pgClient.query<{ counter: number; last_used_at: string }>(
          `SELECT counter, last_used_at FROM passkey`,
        )
      ).rows[0]!;
      expect(passkeyRow.counter).toBe(1);
      expect(passkeyRow.last_used_at).not.toBeNull();
    });

    it('rejects an unknown credential', async () => {
      // GIVEN: no passkey in DB

      // WHEN
      const beginResponse = await request(app.getHttpServer())
        .post('/auth/login/begin')
        .expect(200);
      const beginResponseBody = beginResponse.body as BeginLoginResponse;

      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/auth/login/complete')
        .send({
          stateId: beginResponseBody.stateId,
          assertion: { id: 'unknown-credential-id' },
        })
        .expect(401);
    });

    it('rejects an unknown stateId on complete', async () => {
      await request(app.getHttpServer())
        .post('/auth/login/complete')
        .send({ stateId: 'made-up-state-id', assertion: { id: 'cred-1' } })
        .expect(400);
    });

    it('rejects a replayed stateId after successful login', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient, {
        webauthnUserId: 'webauthn-test',
      });
      await seedPasskey(pgClient, { userId });

      const beginResponse = await request(app.getHttpServer())
        .post('/auth/login/begin')
        .expect(200);
      const { stateId } = beginResponse.body as BeginLoginResponse;

      await request(app.getHttpServer())
        .post('/auth/login/complete')
        .send({ stateId, assertion: { id: 'cred-1' } })
        .expect(204);

      // WHEN: replay the same stateId
      await request(app.getHttpServer())
        .post('/auth/login/complete')
        .send({ stateId, assertion: { id: 'cred-1' } })
        .expect(400);
    });
  });

  describe('logout', () => {
    it('logs out', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, {
        userId,
        token: 'c19b19f2d4fb4f499a281779498b3677',
      });

      // WHEN
      const logoutResponse = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', `session_token=c19b19f2d4fb4f499a281779498b3677`)
        .expect(204);

      // THEN
      const resRows = (
        await pgClient.query<{ revoked_at: Date | null }>(
          `SELECT revoked_at FROM session WHERE token = $1`,
          ['c19b19f2d4fb4f499a281779498b3677'],
        )
      ).rows;
      expect(resRows[0]!.revoked_at).not.toBeNull();
      expect(logoutResponse.headers['set-cookie']![0]).toMatch(
        /session_token=;/,
      );
    });

    it('succeeds without a cookie', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);
    });
  });

  describe('me', () => {
    it('returns user data for a valid session', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });

      // WHEN
      const response = await request(app.getHttpServer())
        .post('/auth/me')
        .set('Cookie', `session_token=valid-session-token`)
        .expect(200);

      // THEN
      expect(response.body).toStrictEqual({
        id: userId,
        name: 'john',
        role: 'user',
      });
    });

    it('returns 401 with no cookie', async () => {
      await request(app.getHttpServer()).post('/auth/me').expect(401);
    });

    it('returns 401 for a revoked session', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, {
        userId,
        token: 'revoked-session-token',
        revoked: true,
      });

      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Cookie', `session_token=revoked-session-token`)
        .expect(401);
    });

    it('returns 401 for an expired session', async () => {
      // GIVEN
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, {
        userId,
        token: 'expired-session-token',
        expiresInDays: -7,
      });

      // WHEN / THEN
      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Cookie', `session_token=expired-session-token`)
        .expect(401);
    });
  });
});

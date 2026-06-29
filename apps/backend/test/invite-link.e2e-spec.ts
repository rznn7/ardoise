import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedInviteLink,
  seedMember,
  seedSession,
  seedUser,
} from './helpers/seed';
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
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, {
        userId,
        token: 'revoked-session-token',
        revoked: true,
      });

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

    it('creates an invite link for a moderator of the group', async () => {
      // GIVEN a user who is a moderator of the target group.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId, groupId, isModerator: true });

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
          burned_at: Date | null;
        }>(`SELECT * FROM invite_link WHERE token = $1`, [body.token])
      ).rows[0]!;
      expect(inviteRow).toMatchObject({
        group_id: groupId,
        single_use: true,
        burned_at: null,
      });
    });

    it('forbids a non-member from minting a link for a group (IDOR)', async () => {
      // GIVEN an authenticated user who is NOT a member of the target group.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);

      // WHEN they try to mint a link by guessing the group id.
      const response = await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=valid-session-token`)
        .send({
          groupId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          singleUse: true,
        })
        .expect(403);

      // THEN it is rejected and no link is created.
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
      const inviteRows = (
        await pgClient.query(`SELECT * FROM invite_link WHERE group_id = $1`, [
          groupId,
        ])
      ).rows;
      expect(inviteRows).toHaveLength(0);
    });

    it('forbids a non-moderator member from minting a link', async () => {
      // GIVEN a plain (non-moderator) member of the group.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId, groupId, isModerator: false });

      // WHEN / THEN
      const response = await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=valid-session-token`)
        .send({
          groupId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          singleUse: true,
        })
        .expect(403);
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('forbids minting a link for a non-existent group (enumeration leaks nothing)', async () => {
      // GIVEN an authenticated user and no such group.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });

      // WHEN / THEN a guessed id yields the same 403 as a real-but-foreign group.
      const response = await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=valid-session-token`)
        .send({
          groupId: 999,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          singleUse: true,
        })
        .expect(403);
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('rejects a body with unexpected extra fields (.strict())', async () => {
      // GIVEN a moderator so validation (not auth) is what rejects the body.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId, groupId, isModerator: true });

      // WHEN an extra field is smuggled in.
      const response = await request(app.getHttpServer())
        .post('/invite-link')
        .set('Cookie', `session_token=valid-session-token`)
        .send({
          groupId,
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          singleUse: true,
          userId: 999,
        })
        .expect(400);

      // THEN it is a validation 400, not a domain discriminator.
      expect(response.body).not.toEqual({ error: 'NOT_A_MEMBER' });
    });
  });

  describe('consume', () => {
    it('joins an authenticated user to the group', async () => {
      // GIVEN a user + session cookie, a group, and a usable invite link for it.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedInviteLink(pgClient, {
        groupId,
        token: 'usable-token',
        expiresInDays: 1,
      });

      // WHEN
      const response = await request(app.getHttpServer())
        .post('/invite-link/consume')
        .set('Cookie', `session_token=valid-session-token`)
        .send({ token: 'usable-token' })
        .expect(200);

      // THEN
      expect(response.body).toEqual({ groupId, alreadyMember: false });

      const memberRows = (
        await pgClient.query(
          `SELECT * FROM member WHERE user_id = $1 AND group_id = $2`,
          [userId, groupId],
        )
      ).rows;
      expect(memberRows).toHaveLength(1);

      const inviteRow = (
        await pgClient.query<{
          burned_by_user_id: number | null;
          burned_at: Date | null;
        }>(`SELECT * FROM invite_link WHERE token = $1`, ['usable-token'])
      ).rows[0]!;
      expect(inviteRow.burned_by_user_id).toBe(userId);
      expect(inviteRow.burned_at).not.toBeNull();
    });

    it('is idempotent when the user is already a member', async () => {
      // GIVEN the user is already a member of the group, plus a usable link for it.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId, groupId });
      await seedInviteLink(pgClient, {
        groupId,
        token: 'usable-token',
        expiresInDays: 1,
      });

      // WHEN
      const response = await request(app.getHttpServer())
        .post('/invite-link/consume')
        .set('Cookie', `session_token=valid-session-token`)
        .send({ token: 'usable-token' })
        .expect(200);

      // THEN
      expect(response.body).toEqual({ groupId, alreadyMember: true });

      const memberRows = (
        await pgClient.query(
          `SELECT * FROM member WHERE user_id = $1 AND group_id = $2`,
          [userId, groupId],
        )
      ).rows;
      expect(memberRows).toHaveLength(1);

      const inviteRow = (
        await pgClient.query<{ burned_at: Date | null }>(
          `SELECT * FROM invite_link WHERE token = $1`,
          ['usable-token'],
        )
      ).rows[0]!;
      expect(inviteRow.burned_at).toBeNull();
    });

    it('concurrent double-consume creates exactly one member', async () => {
      // GIVEN user + session + group + usable link.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedInviteLink(pgClient, {
        groupId,
        token: 'usable-token',
        expiresInDays: 1,
      });

      // WHEN two consume requests fire in parallel.
      const post = () =>
        request(app.getHttpServer())
          .post('/invite-link/consume')
          .set('Cookie', `session_token=valid-session-token`)
          .send({ token: 'usable-token' });
      const [first, second] = await Promise.all([post(), post()]);

      // THEN both succeed and exactly one member row exists.
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const memberRows = (
        await pgClient.query(
          `SELECT * FROM member WHERE user_id = $1 AND group_id = $2`,
          [userId, groupId],
        )
      ).rows;
      expect(memberRows).toHaveLength(1);
    });

    it('rejects not-found / expired / consumed with a discriminator', async () => {
      // GIVEN an authenticated user (not a member of any group) + a group.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      // another user who burned a single-use link (consumed by someone else).
      const { id: otherUserId } = await seedUser(pgClient, { name: 'jane' });
      await seedInviteLink(pgClient, {
        groupId,
        token: 'expired-token',
        expiresInDays: -1,
      });
      await seedInviteLink(pgClient, {
        groupId,
        token: 'consumed-token',
        expiresInDays: 1,
        burnedByUserId: otherUserId,
      });

      const post = (token: string) =>
        request(app.getHttpServer())
          .post('/invite-link/consume')
          .set('Cookie', `session_token=valid-session-token`)
          .send({ token });

      const notFound = await post('does-not-exist').expect(400);
      expect(notFound.body).toEqual({ error: 'INVITE_NOT_FOUND' });

      const expired = await post('expired-token').expect(400);
      expect(expired.body).toEqual({ error: 'INVITE_EXPIRED' });

      const consumed = await post('consumed-token').expect(400);
      expect(consumed.body).toEqual({ error: 'INVITE_CONSUMED' });
    });

    it('rejects unauthenticated and malformed requests', async () => {
      // GIVEN a valid session so validation (not auth) is what rejects the bad bodies.
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });

      // no cookie -> 401 (SessionGuard).
      await request(app.getHttpServer())
        .post('/invite-link/consume')
        .send({ token: 'whatever' })
        .expect(401);

      const post = (body: string | object) =>
        request(app.getHttpServer())
          .post('/invite-link/consume')
          .set('Cookie', `session_token=valid-session-token`)
          .send(body);

      // A domain discriminator envelope is exactly { error: "INVITE_*" }; a
      // validation 400 must NOT look like one.
      const isDiscriminator = (body: unknown) =>
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string' &&
        body.error.startsWith('INVITE_');

      // empty token -> 400 (min(1)).
      const empty = await post({ token: '' }).expect(400);
      expect(isDiscriminator(empty.body)).toBe(false);

      // token > 64 chars -> 400 (max(64)).
      const tooLong = await post({ token: 'x'.repeat(65) }).expect(400);
      expect(isDiscriminator(tooLong.body)).toBe(false);

      // unexpected extra field -> 400 (.strict()).
      const extra = await post({ token: 'usable-token', userId: 999 }).expect(
        400,
      );
      expect(isDiscriminator(extra.body)).toBe(false);
    });

    it('admits multiple distinct users to a multi-use link', async () => {
      const { id: groupId } = await seedGroup(pgClient);
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      await seedSession(pgClient, { userId: userAId, token: 'session-a' });
      const { id: userBId } = await seedUser(pgClient, { name: 'bob' });
      await seedSession(pgClient, { userId: userBId, token: 'session-b' });
      await seedInviteLink(pgClient, {
        groupId,
        token: 'multi-use-token',
        singleUse: false,
        expiresInDays: 1,
      });

      const consume = (sessionToken: string) =>
        request(app.getHttpServer())
          .post('/invite-link/consume')
          .set('Cookie', `session_token=${sessionToken}`)
          .send({ token: 'multi-use-token' });

      const first = await consume('session-a').expect(200);
      expect(first.body).toEqual({ groupId, alreadyMember: false });

      const second = await consume('session-b').expect(200);
      expect(second.body).toEqual({ groupId, alreadyMember: false });

      const memberRows = (
        await pgClient.query(`SELECT * FROM member WHERE group_id = $1`, [
          groupId,
        ])
      ).rows;
      expect(memberRows).toHaveLength(2);

      const inviteRow = (
        await pgClient.query<{
          burned_at: Date | null;
          burned_by_user_id: number | null;
        }>(`SELECT * FROM invite_link WHERE token = $1`, ['multi-use-token'])
      ).rows[0]!;
      expect(inviteRow.burned_at).toBeNull();
      expect(inviteRow.burned_by_user_id).toBeNull();
    });

    it('rejects an expired multi-use link with INVITE_EXPIRED', async () => {
      const { id: userId } = await seedUser(pgClient);
      await seedSession(pgClient, { userId, token: 'valid-session-token' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedInviteLink(pgClient, {
        groupId,
        token: 'expired-multi-use-token',
        singleUse: false,
        expiresInDays: -1,
      });

      const response = await request(app.getHttpServer())
        .post('/invite-link/consume')
        .set('Cookie', `session_token=valid-session-token`)
        .send({ token: 'expired-multi-use-token' })
        .expect(400);

      expect(response.body).toEqual({ error: 'INVITE_EXPIRED' });
    });

    it('burns a single-use link after the first consume', async () => {
      const { id: groupId } = await seedGroup(pgClient);
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      await seedSession(pgClient, { userId: userAId, token: 'session-a' });
      const { id: userBId } = await seedUser(pgClient, { name: 'bob' });
      await seedSession(pgClient, { userId: userBId, token: 'session-b' });
      await seedInviteLink(pgClient, {
        groupId,
        token: 'single-use-token',
        singleUse: true,
        expiresInDays: 1,
      });

      const consume = (sessionToken: string) =>
        request(app.getHttpServer())
          .post('/invite-link/consume')
          .set('Cookie', `session_token=${sessionToken}`)
          .send({ token: 'single-use-token' });

      const first = await consume('session-a').expect(200);
      expect(first.body).toEqual({ groupId, alreadyMember: false });

      const burnedRow = (
        await pgClient.query<{
          burned_at: Date | null;
          burned_by_user_id: number | null;
        }>(`SELECT * FROM invite_link WHERE token = $1`, ['single-use-token'])
      ).rows[0]!;
      expect(burnedRow.burned_at).not.toBeNull();
      expect(burnedRow.burned_by_user_id).toBe(userAId);

      const second = await consume('session-b').expect(400);
      expect(second.body).toEqual({ error: 'INVITE_CONSUMED' });

      const memberRows = (
        await pgClient.query(`SELECT * FROM member WHERE group_id = $1`, [
          groupId,
        ])
      ).rows;
      expect(memberRows).toHaveLength(1);
    });
  });
});

import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedInviteLink,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('Admin revoke', () => {
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

  async function seedPeople() {
    const admin = await seedUser(pgClient, { name: 'Ada', role: 'admin' });
    await seedSession(pgClient, { userId: admin.id, token: 'admin-token' });
    const lea = await seedUser(pgClient, { name: 'Léa' });
    await seedSession(pgClient, { userId: lea.id, token: 'lea-token' });
    const sessionId = async (token: string): Promise<number> => {
      const { rows } = await pgClient.query<{ id: number }>(
        'SELECT id FROM session WHERE token = $1',
        [token],
      );
      return rows[0]!.id;
    };
    return { sessionId };
  }

  const post = (path: string, token: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Cookie', `session_token=${token}`);

  describe('invite links', () => {
    it('revokes a link so it can no longer be previewed', async () => {
      await seedPeople();
      const { id: groupId } = await seedGroup(pgClient);
      const link = await seedInviteLink(pgClient, {
        groupId,
        token: 'to-revoke',
      });

      await post(
        `/admin/invite-links/${String(link.id)}/revoke`,
        'admin-token',
      ).expect(204);

      const preview = await request(app.getHttpServer())
        .get('/invite-link/to-revoke/preview')
        .expect(400);
      expect(preview.body).toEqual({ error: 'INVITE_EXPIRED' });
    });

    it('is a no-op the second time', async () => {
      await seedPeople();
      const { id: groupId } = await seedGroup(pgClient);
      const link = await seedInviteLink(pgClient, { groupId });

      await post(
        `/admin/invite-links/${String(link.id)}/revoke`,
        'admin-token',
      ).expect(204);
      await post(
        `/admin/invite-links/${String(link.id)}/revoke`,
        'admin-token',
      ).expect(204);
    });

    it('returns 404 for an unknown link', async () => {
      await seedPeople();

      await post('/admin/invite-links/999/revoke', 'admin-token').expect(404);
    });

    it('returns 403 for a plain user', async () => {
      await seedPeople();
      const { id: groupId } = await seedGroup(pgClient);
      const link = await seedInviteLink(pgClient, { groupId });

      await post(
        `/admin/invite-links/${String(link.id)}/revoke`,
        'lea-token',
      ).expect(403);
    });
  });

  describe('sessions', () => {
    it('revoked session gets 401', async () => {
      const { sessionId } = await seedPeople();

      await post(
        `/admin/sessions/${String(await sessionId('lea-token'))}/revoke`,
        'admin-token',
      ).expect(204);

      await request(app.getHttpServer())
        .post('/auth/me')
        .set('Cookie', 'session_token=lea-token')
        .expect(401);
    });

    it('is a no-op the second time', async () => {
      const { sessionId } = await seedPeople();
      const id = String(await sessionId('lea-token'));

      await post(`/admin/sessions/${id}/revoke`, 'admin-token').expect(204);
      await post(`/admin/sessions/${id}/revoke`, 'admin-token').expect(204);
    });

    it('returns 404 for an unknown session', async () => {
      await seedPeople();

      await post('/admin/sessions/999/revoke', 'admin-token').expect(404);
    });

    it('returns 403 for a plain user', async () => {
      const { sessionId } = await seedPeople();

      await post(
        `/admin/sessions/${String(await sessionId('admin-token'))}/revoke`,
        'lea-token',
      ).expect(403);
    });

    it("refuses the caller's current session", async () => {
      const { sessionId } = await seedPeople();

      const response = await post(
        `/admin/sessions/${String(await sessionId('admin-token'))}/revoke`,
        'admin-token',
      ).expect(400);

      expect(response.body).toEqual({ error: 'CANNOT_REVOKE_CURRENT_SESSION' });
    });
  });
});

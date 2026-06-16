import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('FindExpenseGroup', () => {
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

  describe('find-by-id', () => {
    it('returns 401 without a cookie', async () => {
      // WHEN / THEN
      await request(app.getHttpServer()).get('/expense-groups/1').expect(401);
    });

    it('returns 403 when the caller is not a member', async () => {
      // GIVEN user A (session) and a group A does not belong to.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });
      const { id: userBId } = await seedUser(pgClient, { name: 'bob' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId: userBId, groupId });

      // WHEN / THEN
      await request(app.getHttpServer())
        .get(`/expense-groups/${String(groupId)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(403);
    });

    it('returns 403 for a non-existent group', async () => {
      // GIVEN user A with a valid session and no groups.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });

      // WHEN / THEN — a non-existent group is indistinguishable from "not a member".
      const response = await request(app.getHttpServer())
        .get('/expense-groups/999999')
        .set('Cookie', `session_token=${token}`)
        .expect(403);
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('returns the group summary when the caller is a member', async () => {
      // GIVEN user A who belongs to group G.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });
      const { id: groupId } = await seedGroup(pgClient, {
        name: 'Trip',
        currencyCode: 'USD',
      });
      await seedMember(pgClient, { userId: userAId, groupId });
      const { created_at: createdAt } = (
        await pgClient.query<{ created_at: Date }>(
          `SELECT created_at FROM expense_group WHERE id = $1`,
          [groupId],
        )
      ).rows[0]!;

      // WHEN
      const response = await request(app.getHttpServer())
        .get(`/expense-groups/${String(groupId)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(200);

      // THEN
      expect(response.body).toEqual({
        id: groupId,
        name: 'Trip',
        currencyCode: 'USD',
        createdAt: createdAt.toISOString(),
      });
    });
  });
});

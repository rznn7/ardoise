import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('FindMember', () => {
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
      await request(app.getHttpServer()).get('/members/1').expect(401);
    });

    it('returns 404 for a non-existent member', async () => {
      // GIVEN user A with a valid session.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });

      // WHEN / THEN
      await request(app.getHttpServer())
        .get('/members/999999')
        .set('Cookie', `session_token=${token}`)
        .expect(404);
    });

    it("returns 403 when the caller is not a member of the target member's group", async () => {
      // GIVEN user A (session) and member B in a group A does not belong to.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });
      const { id: userBId } = await seedUser(pgClient, { name: 'bob' });
      const { id: groupId } = await seedGroup(pgClient);
      const { id: memberBId } = await seedMember(pgClient, {
        userId: userBId,
        groupId,
      });

      // WHEN / THEN
      const response = await request(app.getHttpServer())
        .get(`/members/${String(memberBId)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(403);
      expect(response.body).toEqual({ error: 'NOT_A_MEMBER' });
    });

    it('returns the member when the caller shares the group', async () => {
      // GIVEN user A and user B both in group G.
      const { id: userAId } = await seedUser(pgClient, { name: 'alice' });
      const { token } = await seedSession(pgClient, { userId: userAId });
      const { id: userBId } = await seedUser(pgClient, { name: 'bob' });
      const { id: groupId } = await seedGroup(pgClient);
      await seedMember(pgClient, { userId: userAId, groupId });
      const { id: memberBId } = await seedMember(pgClient, {
        userId: userBId,
        groupId,
        nickname: 'Bob',
        isModerator: true,
      });

      // WHEN
      const response = await request(app.getHttpServer())
        .get(`/members/${String(memberBId)}`)
        .set('Cookie', `session_token=${token}`)
        .expect(200);

      // THEN — MemberResponse includes groupId (direct fetch, not nested under a group path).
      expect(response.body).toEqual({
        id: memberBId,
        userId: userBId,
        groupId,
        nickname: 'Bob',
        isModerator: true,
      });
    });
  });
});

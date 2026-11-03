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
import { openStream, type SseClient } from './helpers/sse';
import { setupTestApp } from './helpers/test-app';

describe('Realtime membership and sessions', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;
  let baseUrl: string;
  const streams: SseClient[] = [];

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 30000);

  afterEach(async () => {
    for (const stream of streams.splice(0)) stream.close();
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, member RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const connect = async (cookie: string) => {
    const stream = await openStream(baseUrl, cookie);
    streams.push(stream);
    await stream.next();
    return stream;
  };

  const seedPerson = async (
    name: string,
    opts: { groupId?: number; role?: 'user' | 'admin' } = {},
  ) => {
    const user = await seedUser(pgClient, { name, role: opts.role });
    const { token } = await seedSession(pgClient, { userId: user.id });
    const { token: secondToken } = await seedSession(pgClient, {
      userId: user.id,
    });
    if (opts.groupId !== undefined) {
      await seedMember(pgClient, { userId: user.id, groupId: opts.groupId });
    }
    return {
      userId: user.id,
      token,
      cookie: `session_token=${token}`,
      secondCookie: `session_token=${secondToken}`,
    };
  };

  const consume = (cookie: string, token: string) =>
    request(app.getHttpServer())
      .post('/invite-link/consume')
      .set('Cookie', cookie)
      .send({ token });

  it('tells every member and the newcomer that someone joined', async () => {
    const group = await seedGroup(pgClient);
    const alice = await seedPerson('alice', { groupId: group.id });
    const dave = await seedPerson('dave');
    const { token } = await seedInviteLink(pgClient, {
      groupId: group.id,
      singleUse: false,
    });
    const aliceStream = await connect(alice.cookie);
    const daveStream = await connect(dave.cookie);

    await consume(dave.cookie, token).expect(200);

    for (const stream of [aliceStream, daveStream]) {
      expect((await stream.next()).data).toEqual({
        type: 'member.joined',
        groupId: group.id,
        userId: dave.userId,
      });
    }
  });

  it('says nothing when the user already belongs to the group', async () => {
    const group = await seedGroup(pgClient);
    const alice = await seedPerson('alice', { groupId: group.id });
    const dave = await seedPerson('dave', { groupId: group.id });
    const { token } = await seedInviteLink(pgClient, {
      groupId: group.id,
      singleUse: false,
    });
    const aliceStream = await connect(alice.cookie);

    await consume(dave.cookie, token).expect(200);

    await aliceStream.nothing(300);
  });

  it('tells the creator sessions about a new group and nobody else', async () => {
    const alice = await seedPerson('alice');
    const bob = await seedPerson('bob');
    const aliceFirst = await connect(alice.cookie);
    const aliceSecond = await connect(alice.secondCookie);
    const bobStream = await connect(bob.cookie);

    const response = await request(app.getHttpServer())
      .post('/expense-groups')
      .set('Cookie', alice.cookie)
      .send({ name: 'Trip', currencyCode: 'EUR' })
      .expect(201);
    const { id } = response.body as { id: number };

    for (const stream of [aliceFirst, aliceSecond]) {
      expect((await stream.next()).data).toEqual({
        type: 'group.created',
        groupId: id,
      });
    }
    await bobStream.nothing(300);
  });

  it('ends only the stream of the session that logged out', async () => {
    const alice = await seedPerson('alice');
    const loggedOut = await connect(alice.cookie);
    const other = await connect(alice.secondCookie);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', alice.cookie)
      .expect(204);

    await loggedOut.ended;
    await other.nothing(300);
  });

  it('ends the stream of a session the admin revokes', async () => {
    const admin = await seedPerson('admin', { role: 'admin' });
    const bob = await seedPerson('bob');
    const bobStream = await connect(bob.cookie);
    const { rows } = await pgClient.query<{ id: number }>(
      'SELECT id FROM session WHERE token = $1',
      [bob.token],
    );

    await request(app.getHttpServer())
      .post(`/admin/sessions/${String(rows[0]!.id)}/revoke`)
      .set('Cookie', admin.cookie)
      .expect(204);

    await bobStream.ended;
  });

  it('ends the stream when its session expires', async () => {
    const user = await seedUser(pgClient, { name: 'alice' });
    await pgClient.query(
      `INSERT INTO session (token, user_id, issued_at, expires_at)
       VALUES ('short-lived', $1, NOW(), NOW() + INTERVAL '1 second')`,
      [user.id],
    );
    const stream = await connect('session_token=short-lived');

    await Promise.race([
      stream.ended,
      new Promise((_, reject) =>
        setTimeout(() => {
          reject(new Error('stream outlived its session'));
        }, 2500),
      ),
    ]);
  });
});

import { type PaymentResponse } from '@ardoise/shared';
import { type INestApplication, Logger } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import { MEMBER_REPOSITORY } from 'src/member/domain/member-repository';
import request from 'supertest';
import { type App } from 'supertest/types';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { seedGroup, seedMember, seedSession, seedUser } from './helpers/seed';
import { openStream, type SseClient } from './helpers/sse';
import { setupTestApp } from './helpers/test-app';

describe('Realtime payments and repayments', () => {
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
    vi.restoreAllMocks();
    for (const stream of streams.splice(0)) stream.close();
    await pgClient.query(
      `TRUNCATE session, users, expense_group, member, payment, payment_share, settlement RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const connect = async (cookie: string, lastEventId?: string) => {
    const stream = await openStream(baseUrl, cookie, lastEventId);
    streams.push(stream);
    await stream.next();
    return stream;
  };

  const seedPerson = async (name: string, groupId?: number) => {
    const user = await seedUser(pgClient, { name });
    const { token } = await seedSession(pgClient, { userId: user.id });
    const { token: secondToken } = await seedSession(pgClient, {
      userId: user.id,
    });
    const member =
      groupId === undefined
        ? null
        : await seedMember(pgClient, { userId: user.id, groupId });
    return {
      cookie: `session_token=${token}`,
      secondCookie: `session_token=${secondToken}`,
      member,
    };
  };

  const seedScene = async () => {
    const group = await seedGroup(pgClient);
    const alice = await seedPerson('alice', group.id);
    const bob = await seedPerson('bob', group.id);
    const carol = await seedPerson('carol');
    return { group, alice, bob, carol };
  };

  type Person = { member: { id: number } | null };

  const updateBody = (alice: Person, bob: Person, title = 'dinner') => ({
    payerMemberId: bob.member?.id,
    title,
    paidAt: '2026-08-16T19:00:00.000Z',
    fullAmount: 4200,
    splitType: 'equal',
    participants: [
      { memberId: alice.member?.id },
      { memberId: bob.member?.id },
    ],
  });

  const paymentBody = (
    groupId: number,
    alice: Person,
    bob: Person,
    title?: string,
  ) => ({ groupId, ...updateBody(alice, bob, title) });

  const post = (cookie: string, body: object, opId?: string) => {
    const req = request(app.getHttpServer())
      .post('/payments')
      .set('Cookie', cookie);
    return (opId === undefined ? req : req.set('x-op-id', opId)).send(body);
  };

  it('pushes a created payment to every member stream, the writer included', async () => {
    const { group, alice, bob, carol } = await seedScene();
    const aliceFirst = await connect(alice.cookie);
    const aliceSecond = await connect(alice.secondCookie);
    const bobStream = await connect(bob.cookie);
    const carolStream = await connect(carol.cookie);

    const response = await post(
      bob.cookie,
      paymentBody(group.id, alice, bob),
      'op-1',
    ).expect(201);
    const { payment } = response.body as { payment: PaymentResponse };

    for (const stream of [aliceFirst, aliceSecond, bobStream]) {
      expect((await stream.next()).data).toEqual({
        type: 'payment.saved',
        groupId: group.id,
        opId: 'op-1',
        payment,
      });
    }
    await carolStream.nothing(300);
  });

  it('pushes an updated payment', async () => {
    const { group, alice, bob } = await seedScene();
    const response = await post(
      bob.cookie,
      paymentBody(group.id, alice, bob),
    ).expect(201);
    const { payment } = response.body as { payment: PaymentResponse };
    const aliceStream = await connect(alice.cookie);

    await request(app.getHttpServer())
      .put(`/payments/${String(payment.id)}`)
      .set('Cookie', bob.cookie)
      .set('x-op-id', 'op-2')
      .send(updateBody(alice, bob, 'brunch'))
      .expect(200);

    expect((await aliceStream.next()).data).toMatchObject({
      type: 'payment.saved',
      opId: 'op-2',
      payment: { id: payment.id, title: 'brunch' },
    });
  });

  it('pushes a deleted payment', async () => {
    const { group, alice, bob } = await seedScene();
    const response = await post(
      bob.cookie,
      paymentBody(group.id, alice, bob),
    ).expect(201);
    const { payment } = response.body as { payment: PaymentResponse };
    const aliceStream = await connect(alice.cookie);

    await request(app.getHttpServer())
      .delete(`/payments/${String(payment.id)}`)
      .set('Cookie', bob.cookie)
      .expect(204);

    expect((await aliceStream.next()).data).toEqual({
      type: 'payment.deleted',
      groupId: group.id,
      opId: null,
      id: payment.id,
    });
  });

  it('pushes a recorded and an undone repayment', async () => {
    const { group, alice, bob } = await seedScene();
    const aliceStream = await connect(alice.cookie);

    const response = await request(app.getHttpServer())
      .post('/settlements')
      .set('Cookie', bob.cookie)
      .send({
        groupId: group.id,
        fromMemberId: bob.member?.id,
        toMemberId: alice.member?.id,
        amount: 1500,
      })
      .expect(201);
    const { id } = response.body as { id: number };

    expect((await aliceStream.next()).data).toMatchObject({
      type: 'settlement.saved',
      groupId: group.id,
      settlement: { id, amount: 1500 },
    });

    await request(app.getHttpServer())
      .delete(`/settlements/${String(id)}`)
      .set('Cookie', bob.cookie)
      .expect(204);

    expect((await aliceStream.next()).data).toEqual({
      type: 'settlement.deleted',
      groupId: group.id,
      opId: null,
      id,
    });
  });

  it('publishes nothing for a refused write', async () => {
    const { group, alice, bob, carol } = await seedScene();
    const aliceStream = await connect(alice.cookie);

    await post(carol.cookie, paymentBody(group.id, alice, bob)).expect(403);

    await aliceStream.nothing(300);
  });

  it('gives consecutive events strictly increasing ids', async () => {
    const { group, alice, bob } = await seedScene();
    const aliceStream = await connect(alice.cookie);

    for (const title of ['a', 'b', 'c']) {
      await post(bob.cookie, paymentBody(group.id, alice, bob, title)).expect(
        201,
      );
    }

    const seqs = [];
    for (let received = 0; received < 3; received++) {
      const { id } = await aliceStream.next();
      seqs.push(Number(id?.split('.')[1]));
    }
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(3);
  });

  it('replays what a reconnecting client missed, then ready', async () => {
    const { group, alice, bob } = await seedScene();
    const first = await openStream(baseUrl, alice.cookie);
    streams.push(first);
    const { id: readyId } = await first.next();
    first.close();

    await post(bob.cookie, paymentBody(group.id, alice, bob, 'one')).expect(
      201,
    );
    await post(bob.cookie, paymentBody(group.id, alice, bob, 'two')).expect(
      201,
    );

    const second = await openStream(baseUrl, alice.cookie, readyId);
    streams.push(second);
    expect((await second.next()).data).toMatchObject({
      type: 'payment.saved',
      payment: { title: 'one' },
    });
    expect((await second.next()).data).toMatchObject({
      type: 'payment.saved',
      payment: { title: 'two' },
    });
    expect((await second.next()).data).toEqual({ type: 'ready' });
  });

  it('drops an invalid op id without refusing the write', async () => {
    const { group, alice, bob } = await seedScene();
    const aliceStream = await connect(alice.cookie);

    await post(
      bob.cookie,
      paymentBody(group.id, alice, bob),
      'x'.repeat(200),
    ).expect(201);

    expect((await aliceStream.next()).data).toMatchObject({
      type: 'payment.saved',
      opId: null,
    });
  });

  it('resets every open stream when a publish fails, and keeps publishing after', async () => {
    const { group, alice, bob } = await seedScene();
    const response = await post(
      bob.cookie,
      paymentBody(group.id, alice, bob),
    ).expect(201);
    const { payment } = response.body as { payment: PaymentResponse };
    const aliceStream = await connect(alice.cookie);
    const members = app.get<{
      findByGroupId: (id: number) => Promise<unknown>;
    }>(MEMBER_REPOSITORY, { strict: false });
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(members, 'findByGroupId').mockRejectedValueOnce(
      new Error('database down'),
    );

    await request(app.getHttpServer())
      .delete(`/payments/${String(payment.id)}`)
      .set('Cookie', bob.cookie)
      .expect(204);

    const reset = await aliceStream.next();
    expect(reset.data).toEqual({ type: 'reset' });
    expect(reset.id).toMatch(/^[a-z0-9]+\.\d+$/);

    await post(bob.cookie, paymentBody(group.id, alice, bob, 'after')).expect(
      201,
    );
    expect((await aliceStream.next()).data).toMatchObject({
      type: 'payment.saved',
      payment: { title: 'after' },
    });
  });
});

import { type FeedItem } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedMember,
  seedPayment,
  seedSession,
  seedSettlement,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('ListGroupFeed', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member, payment, payment_share, settlement RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const seedPair = async () => {
    const alice = await seedUser(pgClient, { name: 'alice' });
    const bob = await seedUser(pgClient, { name: 'bob' });
    const group = await seedGroup(pgClient);
    const mAlice = await seedMember(pgClient, {
      userId: alice.id,
      groupId: group.id,
    });
    const mBob = await seedMember(pgClient, {
      userId: bob.id,
      groupId: group.id,
    });
    const { token } = await seedSession(pgClient, { userId: alice.id });
    return { group, mAlice, mBob, token };
  };

  const getFeed = (groupId: number, token: string) =>
    request(app.getHttpServer())
      .get(`/expense-groups/${String(groupId)}/feed`)
      .set('Cookie', `session_token=${token}`);

  const describeItem = (item: FeedItem): string =>
    item.kind === 'payment'
      ? `payment:${item.payment.title}`
      : `settlement:${String(item.settlement.amount)}`;

  it('returns 401 without a cookie', async () => {
    const group = await seedGroup(pgClient);

    await request(app.getHttpServer())
      .get(`/expense-groups/${String(group.id)}/feed`)
      .expect(401);
  });

  it('returns 403 when the caller is not a member', async () => {
    const outsider = await seedUser(pgClient, { name: 'eve' });
    const group = await seedGroup(pgClient);
    const { token } = await seedSession(pgClient, { userId: outsider.id });

    await getFeed(group.id, token).expect(403);
  });

  it('returns an empty list for a group with no activity', async () => {
    const { group, token } = await seedPair();

    const response = await getFeed(group.id, token).expect(200);

    expect(response.body).toEqual([]);
  });

  it('mixes payments and settlements, newest first', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      title: 'yesterday',
      paidAt: new Date('2026-10-19T12:00:00.000Z'),
    });
    await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: mBob.id,
      toMemberId: mAlice.id,
      amount: 500,
      settledAt: new Date('2026-10-20T12:00:00.000Z'),
    });
    await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mBob.id,
      title: 'tomorrow',
      paidAt: new Date('2026-10-21T12:00:00.000Z'),
    });

    const response = await getFeed(group.id, token).expect(200);

    expect((response.body as FeedItem[]).map(describeItem)).toEqual([
      'payment:tomorrow',
      'settlement:500',
      'payment:yesterday',
    ]);
  });

  it('orders items with the same date by id descending', async () => {
    const { group, mAlice, token } = await seedPair();
    const paidAt = new Date('2026-10-19T12:00:00.000Z');
    await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      title: 'first',
      paidAt,
    });
    await seedPayment(pgClient, {
      groupId: group.id,
      payerMemberId: mAlice.id,
      title: 'second',
      paidAt,
    });

    const response = await getFeed(group.id, token).expect(200);

    expect((response.body as FeedItem[]).map(describeItem)).toEqual([
      'payment:second',
      'payment:first',
    ]);
  });

  it('lists a feed with only settlements', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    const { id } = await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: mBob.id,
      toMemberId: mAlice.id,
      amount: 1200,
    });

    const response = await getFeed(group.id, token).expect(200);

    expect(response.body).toEqual([
      {
        kind: 'settlement',
        settlement: expect.objectContaining({
          id,
          fromMemberId: mBob.id,
          toMemberId: mAlice.id,
          amount: 1200,
        }) as unknown,
      },
    ]);
  });

  it('leaves out the activity of other groups', async () => {
    const { group, token } = await seedPair();
    const other = await seedPair();
    await seedPayment(pgClient, {
      groupId: other.group.id,
      payerMemberId: other.mAlice.id,
    });
    await seedSettlement(pgClient, {
      groupId: other.group.id,
      fromMemberId: other.mBob.id,
      toMemberId: other.mAlice.id,
      amount: 100,
    });

    const response = await getFeed(group.id, token).expect(200);

    expect(response.body).toEqual([]);
  });
});

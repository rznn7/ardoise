import { type FeedItem, type FeedPage } from '@ardoise/shared';
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

  const getFeed = (groupId: number, token: string, cursor?: string) =>
    request(app.getHttpServer())
      .get(`/expense-groups/${String(groupId)}/feed`)
      .query(cursor === undefined ? {} : { cursor })
      .set('Cookie', `session_token=${token}`);

  const seedPayments = (
    groupId: number,
    payerMemberId: number,
    count: number,
    newest: string,
  ) =>
    pgClient.query(
      `INSERT INTO payment (group_id, payer_member_id, title, full_amount, split_type, paid_at)
       SELECT $1, $2, 'p' || i, 1000, 'equal', $3::timestamptz - (i || ' hours')::interval
       FROM generate_series(1, $4) AS i`,
      [groupId, payerMemberId, newest, count],
    );

  const walk = async (groupId: number, token: string) => {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < 20; pages++) {
      const page = (await getFeed(groupId, token, cursor).expect(200))
        .body as FeedPage;
      expect(page.items.length).toBeLessThanOrEqual(50);
      seen.push(...page.items.map(keyOf));
      if (page.nextCursor === null) return seen;
      cursor = page.nextCursor;
    }
    throw new Error('the feed never ended');
  };

  const keyOf = (item: FeedItem): string =>
    item.kind === 'payment'
      ? `payment:${String(item.payment.id)}`
      : `settlement:${String(item.settlement.id)}`;

  const expectedOrder = async (groupId: number): Promise<string[]> => {
    const { rows } = await pgClient.query<{ key: string }>(
      `SELECT key FROM (
         SELECT 'payment:' || id AS key, date_trunc('milliseconds', paid_at) AS d, 0 AS rank, id FROM payment WHERE group_id = $1
         UNION ALL
         SELECT 'settlement:' || id, date_trunc('milliseconds', settled_at), 1, id FROM settlement WHERE group_id = $1
       ) feed ORDER BY d DESC, rank ASC, id DESC`,
      [groupId],
    );
    return rows.map((row) => row.key);
  };

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

    expect(response.body).toEqual({ items: [], nextCursor: null });
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

    expect((response.body as FeedPage).items.map(describeItem)).toEqual([
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

    expect((response.body as FeedPage).items.map(describeItem)).toEqual([
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

    expect((response.body as FeedPage).items).toEqual([
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

    expect(response.body).toEqual({ items: [], nextCursor: null });
  });

  it('returns the first 50 and a cursor', async () => {
    const { group, mAlice, token } = await seedPair();
    await seedPayments(group.id, mAlice.id, 51, '2026-10-20T12:00:00.000Z');

    const page = (await getFeed(group.id, token).expect(200)).body as FeedPage;

    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it('has a null cursor on the last page', async () => {
    const { group, mAlice, token } = await seedPair();
    await seedPayments(group.id, mAlice.id, 50, '2026-10-20T12:00:00.000Z');

    const page = (await getFeed(group.id, token).expect(200)).body as FeedPage;

    expect(page.items).toHaveLength(50);
    expect(page.nextCursor).toBeNull();
  });

  it('walks every page once, ties included', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedPayments(group.id, mAlice.id, 90, '2026-10-20T12:00:00.000Z');
    await pgClient.query(
      `INSERT INTO payment (group_id, payer_member_id, title, full_amount, split_type, paid_at)
       SELECT $1, $2, 'tie' || i, 1000, 'equal', '2026-10-18T09:00:00.000Z' FROM generate_series(1, 30) AS i`,
      [group.id, mBob.id],
    );
    await pgClient.query(
      `INSERT INTO settlement (group_id, from_member_id, to_member_id, created_by_member_id, amount, settled_at)
       SELECT $1, $2, $3, $2, 100 * i, CASE WHEN i <= 5 THEN '2026-10-18T09:00:00.000Z'::timestamptz ELSE '2026-10-15T12:00:00.000Z'::timestamptz - (i || ' hours')::interval END
       FROM generate_series(1, 15) AS i`,
      [group.id, mBob.id, mAlice.id],
    );

    const seen = await walk(group.id, token);

    expect(seen).toHaveLength(135);
    expect(seen).toEqual(await expectedOrder(group.id));
  });

  it('neither skips nor repeats sub-millisecond timestamps at a page boundary', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedPayments(group.id, mAlice.id, 49, '2026-10-25T12:00:00.000Z');
    await pgClient.query(
      `INSERT INTO settlement (group_id, from_member_id, to_member_id, created_by_member_id, amount, settled_at)
       VALUES ($1, $2, $3, $2, 100, '2026-10-20T12:00:00.123100Z'), ($1, $2, $3, $2, 200, '2026-10-20T12:00:00.123400Z')`,
      [group.id, mBob.id, mAlice.id],
    );

    const seen = await walk(group.id, token);

    expect(seen).toHaveLength(51);
    expect(new Set(seen).size).toBe(51);
  });

  it('rejects an invalid cursor', async () => {
    const { group, token } = await seedPair();

    const response = await getFeed(group.id, token, 'nope').expect(400);

    expect(response.body).toEqual({ error: 'INVALID_CURSOR' });
  });
});

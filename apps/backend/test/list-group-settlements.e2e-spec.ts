import { type SettlementPage } from '@ardoise/shared';
import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedMember,
  seedSession,
  seedSettlement,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('ListGroupSettlements', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, member, settlement RESTART IDENTITY CASCADE`,
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

  const seedSettlements = (
    groupId: number,
    fromMemberId: number,
    toMemberId: number,
    count: number,
    settledAt: string,
  ) =>
    pgClient.query(
      `INSERT INTO settlement (group_id, from_member_id, to_member_id, created_by_member_id, amount, settled_at)
       SELECT $1, $2, $3, $2, 100 * i, $4::timestamptz - (i || ' hours')::interval
       FROM generate_series(1, $5) AS i`,
      [groupId, fromMemberId, toMemberId, settledAt, count],
    );

  const list = (groupId: number, token: string, cursor?: string) =>
    request(app.getHttpServer())
      .get(`/expense-groups/${String(groupId)}/settlements`)
      .query(cursor === undefined ? {} : { cursor })
      .set('Cookie', `session_token=${token}`);

  const walk = async (groupId: number, token: string) => {
    const seen: number[] = [];
    let cursor: string | undefined;
    for (let pages = 0; pages < 10; pages++) {
      const page = (await list(groupId, token, cursor).expect(200))
        .body as SettlementPage;
      expect(page.items.length).toBeLessThanOrEqual(50);
      seen.push(...page.items.map((item) => item.id));
      if (page.nextCursor === null) return seen;
      cursor = page.nextCursor;
    }
    throw new Error('the list never ended');
  };

  it('lists repayments newest first, 50 per page', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedSettlements(
      group.id,
      mBob.id,
      mAlice.id,
      51,
      '2026-10-20T12:00:00Z',
    );

    const page = (await list(group.id, token).expect(200))
      .body as SettlementPage;

    expect(page.items).toHaveLength(50);
    expect(page.items.map((item) => item.amount).slice(0, 3)).toEqual([
      100, 200, 300,
    ]);
    expect(page.nextCursor).toEqual(expect.any(String));
  });

  it('walks every page once, ties included', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedSettlements(
      group.id,
      mBob.id,
      mAlice.id,
      40,
      '2026-10-20T12:00:00Z',
    );
    await pgClient.query(
      `INSERT INTO settlement (group_id, from_member_id, to_member_id, created_by_member_id, amount, settled_at)
       SELECT $1, $2, $3, $2, 7, '2026-10-19T00:30:00Z' FROM generate_series(1, 20)`,
      [group.id, mAlice.id, mBob.id],
    );
    const { rows } = await pgClient.query<{ id: number }>(
      `SELECT id FROM settlement ORDER BY date_trunc('milliseconds', settled_at) DESC, id DESC`,
    );

    expect(await walk(group.id, token)).toEqual(rows.map((row) => row.id));
  });

  it('has a null cursor on the last page', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    await seedSettlement(pgClient, {
      groupId: group.id,
      fromMemberId: mBob.id,
      toMemberId: mAlice.id,
      amount: 500,
    });

    const page = (await list(group.id, token).expect(200))
      .body as SettlementPage;

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  it('lists only this group', async () => {
    const { group, mAlice, mBob, token } = await seedPair();
    const other = await seedGroup(pgClient);
    await seedSettlements(
      other.id,
      mBob.id,
      mAlice.id,
      3,
      '2026-10-20T12:00:00Z',
    );

    const page = (await list(group.id, token).expect(200))
      .body as SettlementPage;

    expect(page).toEqual({ items: [], nextCursor: null });
  });

  it('rejects an invalid cursor', async () => {
    const { group, token } = await seedPair();

    const response = await list(group.id, token, 'nope').expect(400);

    expect(response.body).toEqual({ error: 'INVALID_CURSOR' });
  });

  it('refuses a non-member', async () => {
    const outsider = await seedUser(pgClient, { name: 'eve' });
    const group = await seedGroup(pgClient);
    const { token } = await seedSession(pgClient, { userId: outsider.id });

    await list(group.id, token).expect(403);
  });
});

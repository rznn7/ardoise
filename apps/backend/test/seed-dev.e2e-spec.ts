import { type INestApplication } from '@nestjs/common';
import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import { seedDemo } from 'scripts/seed/demo-scenario';
import request from 'supertest';
import { type App } from 'supertest/types';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  seedGroup,
  seedMember,
  seedPasskey,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

const LOCAL = 'http://localhost:4200';
const PREVIEW = 'https://ardoise.rznn.dev';

describe('Dev seed', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;
  let app: INestApplication<App>;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE settlement, payment_share, payment, member, invite_link, session, passkey, login_state, registration_state, expense_group, users RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const count = async (table: string): Promise<number> => {
    const { rows } = await pgClient.query<{ n: string }>(
      `SELECT count(*) AS n FROM ${table}`,
    );
    return Number(rows[0]?.n);
  };

  const membership = async (
    userId: number,
    groupName: string,
  ): Promise<{ id: number; is_moderator: boolean } | undefined> => {
    const { rows } = await pgClient.query<{
      id: number;
      is_moderator: boolean;
    }>(
      `SELECT m.id, m.is_moderator FROM member m JOIN expense_group g ON g.id = m.group_id
       WHERE m.user_id = $1 AND g.name = $2`,
      [userId, groupName],
    );
    return rows[0];
  };

  const userIdByName = async (name: string): Promise<number | undefined> => {
    const { rows } = await pgClient.query<{ id: number }>(
      `SELECT id FROM users WHERE name = $1`,
      [name],
    );
    return rows[0]?.id;
  };

  const seedRealAccount = async (
    name: string,
    token?: string,
  ): Promise<number> => {
    const { id } = await seedUser(pgClient, { name });
    await seedPasskey(pgClient, { userId: id, credentialId: `cred-${name}` });
    if (token) await seedSession(pgClient, { userId: id, token });
    return id;
  };

  it('builds the scenario around a fictional Alice when there is no real account', async () => {
    const report = await seedDemo(pgClient, { origin: LOCAL });

    const aliceId = await userIdByName('Alice');
    expect(aliceId).toBeDefined();
    expect(report.primaryUserId).toBe(aliceId);
    expect(report.realAccountCount).toBe(0);
    expect(report.sessionToken).not.toBeNull();
    expect(await count('passkey')).toBe(0);
    expect(await count('expense_group')).toBe(4);
    expect(await count('payment')).toBe(137);
    expect(await membership(aliceId!, 'Trip to Lisbon')).toMatchObject({
      is_moderator: true,
    });
    expect(await membership(aliceId!, 'Ski 2027')).toMatchObject({
      is_moderator: true,
    });
    expect(await membership(aliceId!, 'Flatshare')).toMatchObject({
      is_moderator: false,
    });
  });

  it('gives the primary account a group in every balance state', async () => {
    const report = await seedDemo(pgClient, { origin: LOCAL });
    const { rows: groups } = await pgClient.query<{ id: number; name: string }>(
      `SELECT id, name FROM expense_group`,
    );
    const nameOf = new Map(groups.map((g) => [g.id, g.name]));

    const response = await request(app.getHttpServer())
      .get('/balances/mine')
      .set('Cookie', `session_token=${report.sessionToken ?? ''}`)
      .expect(200);

    const balances = new Map(
      (response.body as { groupId: number; amount: number }[]).map((b) => [
        nameOf.get(b.groupId),
        b.amount,
      ]),
    );
    expect(balances.get('Trip to Lisbon')).toBeGreaterThan(0);
    expect(balances.get('Flatshare')).toBeLessThan(0);
    expect(balances.get('Ski 2027')).toBe(0);
    expect(balances.get('Friday dinners')).toBe(0);
    const { rows } = await pgClient.query(
      `SELECT p.id FROM payment p JOIN expense_group g ON g.id = p.group_id WHERE g.name = 'Friday dinners'`,
    );
    expect(rows).toHaveLength(2);
  });

  it('makes the primary account an admin, Alice or a kept real account', async () => {
    await seedDemo(pgClient, { origin: LOCAL });
    const roleOf = async (name: string) => {
      const { rows } = await pgClient.query<{ role: string }>(
        'SELECT role FROM users WHERE name = $1',
        [name],
      );
      return rows[0]?.role;
    };
    expect(await roleOf('Alice')).toBe('admin');
    expect(await roleOf('Bob')).toBe('user');

    await seedRealAccount('Owner', 'kept-token');
    await seedDemo(pgClient, { origin: PREVIEW });
    expect(await roleOf('Owner')).toBe('admin');
  });

  it('shows the admin a user with no group and invite links in every status', async () => {
    await seedDemo(pgClient, { origin: LOCAL });

    const { rows: loners } = await pgClient.query<{ name: string }>(
      'SELECT name FROM users u WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.user_id = u.id)',
    );
    expect(loners.map((u) => u.name)).toEqual(['Emma']);
    const { rows: links } = await pgClient.query<{
      burned: boolean;
      expired: boolean;
      revoked: boolean;
    }>(
      `SELECT burned_at IS NOT NULL AS burned, expires_at < NOW() AS expired, revoked_at IS NOT NULL AS revoked
       FROM invite_link i JOIN expense_group g ON g.id = i.group_id WHERE g.name = 'Trip to Lisbon' ORDER BY i.id`,
    );
    expect(links).toEqual([
      { burned: false, expired: false, revoked: false },
      { burned: true, expired: false, revoked: false },
      { burned: false, expired: true, revoked: false },
      { burned: false, expired: false, revoked: true },
    ]);
  });

  it('gives Flatshare a history long enough to load several pages', async () => {
    await seedDemo(pgClient, { origin: LOCAL });

    const { rows } = await pgClient.query<{
      payments: string;
      settlements: string;
      oldest: Date;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM payment p JOIN expense_group g ON g.id = p.group_id WHERE g.name = 'Flatshare') AS payments,
         (SELECT COUNT(*) FROM settlement s JOIN expense_group g ON g.id = s.group_id WHERE g.name = 'Flatshare') AS settlements,
         (SELECT MIN(paid_at) FROM payment p JOIN expense_group g ON g.id = p.group_id WHERE g.name = 'Flatshare') AS oldest`,
    );
    const [history] = rows;
    expect(
      Number(history?.payments) + Number(history?.settlements),
    ).toBeGreaterThan(100);
    expect(Number(history?.settlements)).toBeGreaterThan(50);
    expect(
      Date.now() - (history?.oldest.getTime() ?? Date.now()),
    ).toBeGreaterThan(200 * 24 * 60 * 60 * 1000);
  });

  it('shows repayments in every state', async () => {
    await seedDemo(pgClient, { origin: LOCAL });

    const { rows } = await pgClient.query<{ name: string; count: string }>(
      `SELECT g.name, COUNT(*) AS count FROM settlement s JOIN expense_group g ON g.id = s.group_id GROUP BY g.name ORDER BY g.name`,
    );
    expect(rows.map((r) => [r.name, Number(r.count)])).toEqual([
      ['Flatshare', 61],
      ['Friday dinners', 1],
      ['Trip to Lisbon', 1],
    ]);
  });

  it('never prints a session token off localhost', async () => {
    const report = await seedDemo(pgClient, { origin: PREVIEW });

    expect(report.sessionToken).toBeNull();
    expect(await count('session')).toBe(0);
    expect(report.inviteUrl.startsWith(`${PREVIEW}/join?token=`)).toBe(true);
  });

  it("keeps a real account and puts it in Alice's place", async () => {
    const ownerId = await seedRealAccount('Owner', 'kept-token');

    const report = await seedDemo(pgClient, { origin: PREVIEW });

    expect(await userIdByName('Owner')).toBe(ownerId);
    expect(await userIdByName('Alice')).toBeUndefined();
    expect(await count('passkey')).toBe(1);
    const { rows: sessions } = await pgClient.query<{ token: string }>(
      `SELECT token FROM session WHERE user_id = $1`,
      [ownerId],
    );
    expect(sessions.map((s) => s.token)).toEqual(['kept-token']);
    expect(report.primaryUserId).toBe(ownerId);
    expect(report.realAccountCount).toBe(1);
    expect(report.sessionToken).toBeNull();
    const lisbon = await membership(ownerId, 'Trip to Lisbon');
    expect(lisbon).toMatchObject({ is_moderator: true });
    const { rows: pizza } = await pgClient.query<{ payer_member_id: number }>(
      `SELECT payer_member_id FROM payment WHERE title = 'Pizza'`,
    );
    expect(pizza[0]?.payer_member_id).toBe(lisbon?.id);
  });

  it('wipes groups a real account created itself', async () => {
    const ownerId = await seedRealAccount('Owner', 'kept-token');
    const phoneGroup = await seedGroup(pgClient, { name: 'Phone group' });
    await seedMember(pgClient, {
      userId: ownerId,
      groupId: phoneGroup.id,
      isModerator: true,
    });

    await seedDemo(pgClient, { origin: PREVIEW });

    const { rows } = await pgClient.query(
      `SELECT id FROM expense_group WHERE name = 'Phone group'`,
    );
    expect(rows).toHaveLength(0);
    expect(await count('session')).toBe(1);
  });

  it('makes the oldest real account primary and the others plain members', async () => {
    const olderId = await seedRealAccount('Older');
    const youngerId = await seedRealAccount('Younger');

    const report = await seedDemo(pgClient, { origin: PREVIEW });

    expect(report.primaryUserId).toBe(olderId);
    expect(report.realAccountCount).toBe(2);
    expect(await membership(olderId, 'Trip to Lisbon')).toMatchObject({
      is_moderator: true,
    });
    for (const group of [
      'Trip to Lisbon',
      'Flatshare',
      'Ski 2027',
      'Friday dinners',
    ]) {
      expect(await membership(youngerId, group)).toMatchObject({
        is_moderator: false,
      });
    }
    const { rows } = await pgClient.query(
      `SELECT ps.payment_id FROM payment_share ps JOIN member m ON m.id = ps.member_id WHERE m.user_id = $1`,
      [youngerId],
    );
    expect(rows).toHaveLength(0);
  });

  it('is idempotent', async () => {
    await seedRealAccount('Owner');

    await seedDemo(pgClient, { origin: PREVIEW });
    const first = {
      users: await count('users'),
      groups: await count('expense_group'),
      payments: await count('payment'),
      shares: await count('payment_share'),
    };
    await seedDemo(pgClient, { origin: PREVIEW });

    expect({
      users: await count('users'),
      groups: await count('expense_group'),
      payments: await count('payment'),
      shares: await count('payment_share'),
    }).toEqual(first);
    expect(first.groups).toBe(4);
    expect(first.payments).toBe(137);
    const { rows } = await pgClient.query<{ name: string; n: string }>(
      `SELECT name, count(*) AS n FROM users WHERE name IN ('Bob', 'Carol', 'David') GROUP BY name`,
    );
    expect(rows.map((r) => [r.name, Number(r.n)]).sort()).toEqual([
      ['Bob', 1],
      ['Carol', 1],
      ['David', 1],
    ]);
  });
});

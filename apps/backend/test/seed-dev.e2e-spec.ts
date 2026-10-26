import { type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { type Client } from 'pg';
import { seedDemo } from 'scripts/seed/demo-scenario';
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
  let closeApp: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupTestApp();
    ({ pgClient, pgContainer } = setup);
    closeApp = () => setup.app.close();
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE payment_share, payment, member, invite_link, session, passkey, login_state, registration_state, expense_group, users RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await closeApp();
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
    expect(await count('expense_group')).toBe(3);
    expect(await count('payment')).toBe(7);
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
    for (const group of ['Trip to Lisbon', 'Flatshare', 'Ski 2027']) {
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
    expect(first.groups).toBe(3);
    expect(first.payments).toBe(7);
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

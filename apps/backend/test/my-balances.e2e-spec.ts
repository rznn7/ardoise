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
  seedPaymentShare,
  seedSession,
  seedUser,
} from './helpers/seed';
import { setupTestApp } from './helpers/test-app';

describe('MyBalances', () => {
  let app: INestApplication<App>;
  let pgContainer: StartedPostgreSqlContainer;
  let pgClient: Client;

  beforeAll(async () => {
    ({ app, pgClient, pgContainer } = await setupTestApp());
  }, 30000);

  afterEach(async () => {
    await pgClient.query(
      `TRUNCATE session, users, expense_group, invite_link, passkey, member, payment, payment_share RESTART IDENTITY CASCADE`,
    );
  });

  afterAll(async () => {
    await app.close();
    await pgClient.end();
    await pgContainer.stop();
  });

  const getMine = (token: string) =>
    request(app.getHttpServer())
      .get('/balances/mine')
      .set('Cookie', `session_token=${token}`);

  it('returns 401 without a cookie', async () => {
    await request(app.getHttpServer()).get('/balances/mine').expect(401);
  });

  it('returns nothing for a user in no group', async () => {
    const alice = await seedUser(pgClient, { name: 'alice' });
    const { token } = await seedSession(pgClient, { userId: alice.id });

    const response = await getMine(token).expect(200);

    expect(response.body).toEqual([]);
  });

  it('returns my balance in each of my groups, and only mine', async () => {
    const alice = await seedUser(pgClient, { name: 'alice' });
    const bob = await seedUser(pgClient, { name: 'bob' });
    const trip = await seedGroup(pgClient, { name: 'trip' });
    const ski = await seedGroup(pgClient, { name: 'ski' });
    const bobsOwn = await seedGroup(pgClient, { name: 'bobs own' });
    const mAlice = await seedMember(pgClient, {
      userId: alice.id,
      groupId: trip.id,
    });
    const mBob = await seedMember(pgClient, {
      userId: bob.id,
      groupId: trip.id,
    });
    await seedMember(pgClient, { userId: alice.id, groupId: ski.id });
    await seedMember(pgClient, { userId: bob.id, groupId: bobsOwn.id });
    const { id: paymentId } = await seedPayment(pgClient, {
      groupId: trip.id,
      payerMemberId: mBob.id,
      fullAmount: 3000,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mAlice.id,
      amount: 1500,
    });
    await seedPaymentShare(pgClient, {
      paymentId,
      memberId: mBob.id,
      amount: 1500,
    });
    const { token } = await seedSession(pgClient, { userId: alice.id });

    const response = await getMine(token).expect(200);

    expect(response.body).toEqual([
      { groupId: trip.id, amount: -1500 },
      { groupId: ski.id, amount: 0 },
    ]);
  });
});
